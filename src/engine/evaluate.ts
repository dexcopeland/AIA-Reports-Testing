import { ASSURANCES, BUILDERS, CAPABILITIES, HARM_TYPES, HOSTING, LEVELS, METHODS, PRIOR, PROCUREMENT, ROLES, TARGETS, labelOf } from "../content/catalog";
import {
  CRITERIA_META,
  DATA_TYPES,
  EVIDENCE_CHECK,
  G1_AREAS,
  G3_AREAS,
  G6_AREAS,
  LEVEL_LABEL,
  LEVEL_SAFEGUARD,
  MITIGATION_BY_ID,
  OVERLAYS,
  PROHIBITED,
  RIGHTS_AREAS,
  RP_META,
  SAFETY_AREAS,
} from "../content/rules";
import {
  CONTRACT_TERMS,
  GROUPS,
  RELATIONS,
  STATEMENT_BY_ID,
  THREATS,
} from "../content/statements";
import { FORM_VERSION, RULES_VERSION, type AnswerFile, type ItemStatus, type StatementDef, type Timing, type TimingProfile } from "../content/types";
import type { Answers } from "./answers";
import { has, many, text } from "./answers";
import {
  areaLabels,
  buildDetail,
  q10Lines,
  q12OutsideLines,
  q13Lines,
  q20Lines,
  q8Lines,
  quoteFromLines,
  renderFinding,
  statementLines,
} from "./findings";
import type { AnswerLine } from "./model";
import { fingerprint } from "./fingerprint";
import type { ConfirmFact, CriterionResult, CrossCheck, Evaluation, Followup, GateHit, LiveMitigation, ResolvedItem } from "./model";
import {
  capabilities,
  dataLevel,
  deployment,
  designFacts,
  outsideContradiction,
  outsideYes,
  privacyTrack,
  procurement,
  selectedGroups,
  showStatement,
  statusConflict,
  vendorInvolved,
} from "./visibility";

const C_ORDER: ItemStatus[] = ["Gap", "Partial", "Met"];
const RP_ORDER: ItemStatus[] = ["Not yet", "Partly in place", "In place"];
const TIMING_RANK: Record<Timing, number> = {
  "Before use": 0,
  "Before purchase": 1,
  "Before deployment": 2,
  Ongoing: 3,
};

function weakest(statuses: ItemStatus[], track: "C" | "RP"): ItemStatus {
  const order = track === "C" ? C_ORDER : RP_ORDER;
  const ranked = statuses.filter((status) => order.includes(status));
  if (ranked.length === 0) return track === "C" ? "Gap" : "Not yet";
  return ranked.reduce((low, status) => (order.indexOf(status) < order.indexOf(low) ? status : low));
}

function toRp(status: ItemStatus): ItemStatus {
  if (status === "Met") return "In place";
  if (status === "Partial") return "Partly in place";
  if (status === "Gap") return "Not yet";
  return status;
}

function thinEvidence(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return true;
  if (EVIDENCE_CHECK.rejectExact.includes(trimmed)) return true;
  return trimmed.split(/\s+/).filter(Boolean).length < EVIDENCE_CHECK.minWords;
}

function middle(track: "C" | "RP"): ItemStatus {
  return track === "C" ? "Partial" : "Partly in place";
}

function individualGroup(answers: Answers, groupId: string | undefined): boolean {
  if (!groupId) return false;
  const relation = text(answers, `q9_rel__${groupId}`);
  return RELATIONS.find((item) => item.id === relation)?.individual ?? false;
}

interface Instance {
  statementId: string;
  instanceId: string;
  context: string;
  groupId?: string;
  designFact?: string | null;
}

function instancesFor(answers: Answers): Instance[] {
  const list: Instance[] = [];
  const add = (id: string, extra?: Partial<Instance>) => {
    if (!showStatement(id, answers)) return;
    list.push({
      statementId: id,
      instanceId: extra?.instanceId ?? id,
      context: extra?.context ?? "",
      groupId: extra?.groupId,
      designFact: extra?.designFact,
    });
  };
  for (const id of ["11a", "11b", "11c", "11d"]) add(id);
  for (const id of ["12a", "12b", "12c", "12d", "12f"]) add(id);
  for (const groupId of selectedGroups(answers)) {
    const group = GROUPS.find((item) => item.id === groupId);
    add("12e", { instanceId: `12e__${groupId}`, context: group?.label ?? groupId, groupId });
  }
  for (const id of ["14a", "14b", "14c", "15a", "15b", "15c", "15d", "16a"]) add(id);
  if (showStatement("16b", answers)) {
    for (const term of CONTRACT_TERMS) {
      add("16b", { instanceId: `16b__${term.id}`, context: term.label });
    }
  }
  add("20a");
  for (const id of ["21a", "21b", "21c", "21d", "21e"]) add(id);
  for (const threat of THREATS) {
    add("22", { instanceId: `22__${threat.id}`, context: threat.label, designFact: threat.designFact });
  }
  add("22f");
  for (const id of ["23a", "23b", "23c", "24a", "24b"]) add(id);
  return list;
}

export function instanceKeys(answers: Answers): { key: string; statementId: string }[] {
  return instancesFor(answers).map((instance) => ({ key: `st${instance.instanceId}`, statementId: instance.statementId }));
}

function resolveOne(def: StatementDef, instance: Instance, answers: Answers): ResolvedItem {
  const raw = text(answers, `st${instance.instanceId}`);
  const evidence = text(answers, `st${instance.instanceId}__evidence`);
  const targetDate = text(answers, `st${instance.instanceId}__date`);
  const picked = def.choices.find((choice) => choice.value === raw);
  const base: ResolvedItem = {
    instanceId: instance.instanceId,
    statementId: def.id,
    legacyQ: def.legacyQ,
    title: def.title,
    context: instance.context,
    choiceValue: picked?.value ?? "unknown",
    choiceText: picked?.text ?? "We don't know / not determined yet",
    status: picked?.status ?? def.unknownStatus,
    mitigation: picked ? picked.mitigation : def.unknownMitigation,
    evidenceFailed: false,
    needsFollowup: !picked || picked.value === "unknown",
    unanswered: !picked || picked.value === "unknown",
    notApplicable: false,
    evidence,
    targetDate,
    feeds: def.feeds,
    track: def.track,
    groupId: instance.groupId,
    individual: individualGroup(answers, instance.groupId) || (def.id === "12d" && individualGroup(answers, "limited_english")),
    designFact: undefined,
  };

  if (picked?.value === "does_not_apply") {
    const fact = instance.designFact;
    if (fact && designFacts(answers).includes(fact)) {
      base.status = "In place";
      base.mitigation = null;
      base.needsFollowup = false;
      base.unanswered = false;
      base.designFact = fact;
    } else {
      base.status = "Not yet";
      base.mitigation = null;
      base.needsFollowup = true;
      base.unanswered = true;
      base.choiceText = "Does not apply was selected without the matching design fact.";
    }
    return base;
  }

  if (picked?.asks === "evidence") {
    const entered = evidence.length > 0;
    const mustCheck = Boolean(picked.evidenceRequired) || entered;
    if (mustCheck && thinEvidence(evidence)) {
      base.status = middle(def.track);
      base.evidenceFailed = true;
      base.needsFollowup = true;
      base.mitigation = base.mitigation ?? fallbackMitigation(def);
    }
  }

  if (picked?.asks === "target_date") {
    base.needsFollowup = targetDate.length === 0;
  }

  if ((def.id === "12d" || def.id === "12e") && base.status !== "Met") {
    base.needsFollowup = true;
    if (!base.individual) base.mitigation = null;
  }

  if (base.status === "Met" || base.status === "In place") base.mitigation = null;
  return base;
}

function fallbackMitigation(def: StatementDef): string | null {
  const withMit = def.choices.find((choice) => choice.mitigation);
  return withMit?.mitigation ?? def.unknownMitigation;
}

function itemsOf(items: ResolvedItem[], id: string): ResolvedItem[] {
  return items.filter((item) => item.statementId === id && !item.notApplicable);
}

function asRp(status: ItemStatus): ItemStatus {
  if (status === "Met" || status === "Partial" || status === "Gap") return toRp(status);
  return status;
}

function statusRank(status: ItemStatus, reported: string): number {
  const reportedIsRp = reported === "Not yet" || reported === "Partly in place" || reported === "In place" || reported === "Not applicable";
  const order = reportedIsRp ? RP_ORDER : C_ORDER;
  const mapped = reportedIsRp ? asRp(status) : status;
  const index = order.indexOf(mapped);
  return index === -1 ? order.length : index;
}

/** Statements whose status is the weakest in the set. That is the answer the finding rests on. */
function drivingItems(items: ResolvedItem[], reported: string): ResolvedItem[] {
  if (items.length === 0) return [];
  let weakestRank = Number.POSITIVE_INFINITY;
  for (const item of items) weakestRank = Math.min(weakestRank, statusRank(item.status, reported));
  const weakestItems = items.filter((item) => statusRank(item.status, reported) === weakestRank);
  const reportedIsRp = reported === "Not yet" || reported === "Partly in place" || reported === "In place" || reported === "Not applicable";
  const exact = weakestItems.filter((item) => (reportedIsRp ? asRp(item.status) : item.status) === reported);
  return exact.length > 0 ? exact : weakestItems;
}

function criterion(id: string, status: string, found: string, answerLines: AnswerLine[], qRefs: string): CriterionResult {
  const meta = CRITERIA_META.find((item) => item.id === id) ?? RP_META.find((item) => item.id === id);
  return { id, name: meta?.name ?? id, status, found, quote: quoteFromLines(answerLines), qRefs, answerLines };
}

function narrateTo(
  id: string,
  status: string,
  items: ResolvedItem[],
  options: { phrase?: string; areas?: string; prefix?: string; lead?: AnswerLine[]; qRefs: string },
): CriterionResult {
  const drivers = drivingItems(items, status);
  const open = drivers.filter((item) => item.status !== "Met" && item.status !== "In place" && item.status !== "Not applicable");
  const found = renderFinding(
    id,
    status,
    { areas: options.areas ?? "", detail: buildDetail(open, options.prefix ?? ""), situation: "" },
    options.phrase,
  );
  const quoted = open.length > 0 ? open : drivers;
  return criterion(id, status, found, [...(options.lead ?? []), ...statementLines(quoted)], options.qRefs);
}

function pickTiming(profile: TimingProfile, answers: Answers, conflict: boolean): Timing {
  const status = deployment(answers);
  const live = status === "live" || conflict;
  const pilot = status === "pilot" && !conflict;
  switch (profile) {
    case "TO":
      return "Ongoing";
    case "TN":
      return live || pilot ? "Before use" : "Before deployment";
    case "TW":
      return live ? "Before use" : "Before deployment";
    case "TC":
      if (live) return "Before use";
      if (pilot) return "Before deployment";
      return "Before purchase";
    default: {
      const never: never = profile;
      return never;
    }
  }
}

function suggestedLevel(answers: Answers): string | null {
  const order = ["L1", "L2", "L3", "L4"];
  let max = -1;
  for (const id of many(answers, "q14_data_types")) {
    const suggests = DATA_TYPES.find((item) => item.id === id)?.suggests;
    if (!suggests) continue;
    max = Math.max(max, order.indexOf(suggests));
  }
  if (max < 0) return null;
  return order[max] ?? null;
}

function deadline(answers: Answers): { date: string | null; line: string; summary: string; followup: boolean } {
  const value = procurement(answers);
  const noDate = "The § 3.5-803(e) deadline depends on the procurement date; DoIT AI Governance will confirm it.";
  if (value === "before_2026_02_01") {
    const date = "1 July 2027";
    return {
      date,
      line: `Assessment deadline: ${date}, because the AI system was procured before 1 February 2026 (§ 3.5-803(e)) [S2].`,
      summary: `The § 3.5-803(e) assessment deadline is ${date}.`,
      followup: false,
    };
  }
  if (value === "on_or_after_2026_02_01") {
    const date = "31 December 2026";
    return {
      date,
      line: `Assessment deadline: ${date}, because the AI system was procured on or after 1 February 2026 (§ 3.5-803(e)) [S2].`,
      summary: `The § 3.5-803(e) assessment deadline is ${date}.`,
      followup: false,
    };
  }
  if (value === "not_yet") {
    const date = "31 December 2026";
    return {
      date,
      line: `Assessment deadline: ${date}, because the AI system is not yet procured (§ 3.5-803(e)) [S2].`,
      summary: `The § 3.5-803(e) assessment deadline is ${date}.`,
      followup: false,
    };
  }
  return {
    date: null,
    line: `Assessment deadline: ${noDate} [S2]`,
    summary: noDate,
    followup: value === "unknown" || value === "",
  };
}

function gate(id: string, name: string, because: string, proposed: boolean): GateHit {
  return { id, name, because, proposed };
}

function buildFollowups(items: ResolvedItem[], answers: Answers, extra: Followup[]): Followup[] {
  const byQ = new Map<number, string[]>();
  const add = (q: number, line: string) => {
    const list = byQ.get(q) ?? [];
    if (!list.includes(line)) list.push(line);
    byQ.set(q, list);
  };
  for (const item of items) {
    if (!item.needsFollowup || item.notApplicable) continue;
    if (item.statementId === "12e" && item.groupId) {
      const name = GROUPS.find((group) => group.id === item.groupId)?.label ?? item.context;
      add(12, `What path can ${name} use to meet this decision or service?`);
      continue;
    }
    if (item.evidenceFailed) {
      add(item.legacyQ, `What record shows the statement you picked for ${item.context || item.title}?`);
      continue;
    }
    if (item.unanswered) {
      add(item.legacyQ, `What is in place today for ${item.context || item.title}?`);
      continue;
    }
    if (item.targetDate === "" && item.needsFollowup) {
      add(item.legacyQ, `What is the target date for ${item.context || item.title}?`);
    }
  }
  for (const item of extra) add(item.q, item.text.replace(/^Q\d+:\s*/, ""));
  const preferred: Record<number, string[]> = {
    10: ["M-REVIEW"],
    11: ["M-REVIEW", "M-TRAIN"],
    12: ["M-ACCESS", "M-LANG", "M-NOTICE", "M-CONTEST", "M-ABUSE"],
    13: ["M-PRIVACY", "M-ENCRYPT"],
    14: ["M-DATAQ"],
    15: ["M-ENCRYPT", "M-PRIVACY"],
    16: ["M-NOTRAIN", "M-CONTRACT"],
    18: [],
    20: ["M-IMPACT"],
    21: ["M-BIAS", "M-ACCURACY", "M-LOG"],
    22: ["M-SEC"],
    23: ["M-OWNER", "M-INCIDENT"],
    24: ["M-CHANGE"],
    1: [],
    7: [],
    9: [],
  };
  const followups: Followup[] = [];
  for (const [q, lines] of [...byQ.entries()].sort((a, b) => a[0] - b[0])) {
    if (q === 25) continue;
    const detail = lines.join(" ");
    followups.push({
      q,
      text: `Q${q}: ${detail}`,
      mitigationId: preferred[q]?.[0] ?? null,
    });
  }
  return followups;
}

function applyCap(list: LiveMitigation[], well: boolean): { kept: LiveMitigation[]; capApplied: boolean } {
  const ongoing = list.find((item) => item.id === "M-ONGOING");
  const rest = list.filter((item) => item.id !== "M-ONGOING");
  const ordered = [...rest].sort((a, b) => {
    const bandA = MITIGATION_BY_ID[a.id]?.capBand ?? 2;
    const bandB = MITIGATION_BY_ID[b.id]?.capBand ?? 2;
    if (bandA !== bandB) return bandA - bandB;
    return TIMING_RANK[a.timing] - TIMING_RANK[b.timing];
  });
  const timingOrder: Timing[] = ["Before purchase", "Before use", "Before deployment", "Ongoing"];
  const sortTiming = (items: LiveMitigation[]) =>
    [...items].sort((a, b) => timingOrder.indexOf(a.timing) - timingOrder.indexOf(b.timing));
  if (!well || ordered.length + (ongoing ? 1 : 0) <= 3) {
    return { kept: sortTiming(ongoing ? [...ordered, ongoing] : ordered), capApplied: false };
  }
  const keptRest = ordered.slice(0, ongoing ? 2 : 3);
  return { kept: sortTiming(ongoing ? [...keptRest, ongoing] : keptRest), capApplied: true };
}

export function evaluate(file: AnswerFile): Evaluation {
  const answers = file.answers ?? {};
  const items = instancesFor(answers).map((instance) => resolveOne(STATEMENT_BY_ID[instance.statementId], instance, answers));
  const areas = many(answers, "q8_areas");
  const rights = areas.some((id) => RIGHTS_AREAS.includes(id));
  const safety = areas.some((id) => SAFETY_AREAS.includes(id));
  const areaLabel = rights && safety ? "both rights-impacting and safety-impacting" : rights ? "rights-impacting" : safety ? "safety-impacting" : "not named in the area list";
  const speech = areas.includes("speech_assembly_religion");
  const caps = capabilities(answers);
  const role = text(answers, "q10_role");
  const review = itemsOf(items, "11a")[0];
  const fullReview = Boolean(review && (review.choiceValue === "every_written" || review.choiceValue === "every_unwritten"));
  const conflict = statusConflict(answers);
  const gates: GateHit[] = [];
  if (areas.some((id) => G1_AREAS.includes(id))) {
    gates.push(gate("G1", "benefits, health, housing, financial or legal rights, or employment", "Q8 names an area in this gate.", false));
  }
  if (areas.some((id) => id === "safety" || id === "critical_infrastructure")) {
    gates.push(gate("G2", "safety", "Q8 names safety or critical infrastructure.", false));
  }
  if (areas.some((id) => G3_AREAS.includes(id))) {
    gates.push(gate("G3", "law enforcement, investigation, identification or automated tickets", "Q8 names an area in this gate. Regulatory inspection alone does not set G3.", false));
  }
  const g4Because: string[] = [];
  if (role === "decides" && !fullReview) g4Because.push("Q10 says the output decides or acts without a person approving each one");
  if (review?.choiceValue === "none" || review?.choiceValue === "after_only" || review?.choiceValue === "sample") {
    g4Because.push("Q11 says review is missing, late or only a sample");
  }
  const g4Cross = caps.includes("acts_in_other_systems") && role === "info_only" && !fullReview;
  if (g4Cross) g4Because.push("Q6 says the output is sent to other systems that act on it, and Q10 says information only");
  if (g4Because.length > 0) {
    const onlyCross = g4Because.length === 1 && g4Cross;
    gates.push(gate("G4", "decides or acts without meaningful human review", g4Because.join("; "), onlyCross));
  }
  if (text(answers, "q8_target") === "places_or_groups" || text(answers, "q8_target") === "both") {
    gates.push(gate("G5", "targeting places or groups", "Q8 says the output picks places, areas or groups.", false));
  }
  if (caps.includes("matches_records") && areas.some((id) => G6_AREAS.includes(id))) {
    gates.push(gate("G6", "record matching with possible adverse action", "Q6 matches records and Q8 names an area where that match can lead to action.", true));
  }
  if (role === "unknown" || role === "" || areas.includes("unknown") || text(answers, "q8_target") === "unknown") {
    gates.push(gate("G7", "decision role or impact unknown", "Q8 or Q10 is Unknown.", false));
  }

  const prohibitedIds = many(answers, "q7b_prohibited").filter((id) => PROHIBITED.some((item) => item.id === id));
  const combo = caps.includes("biometric_id") && areas.includes("identifying_people");
  const prohibited = prohibitedIds.length > 0 || combo;
  const prohibitedLabels = [
    ...prohibitedIds.map((id) => PROHIBITED.find((item) => item.id === id)?.label ?? id),
    ...(combo && prohibitedIds.length === 0 ? ["Identifies people from biometrics in a setting aimed at identifying people"] : []),
  ];

  const level = dataLevel(answers);
  const suggested = suggestedLevel(answers);
  const levelIndex = ["L1", "L2", "L3", "L4"];
  const suggestedHigher =
    suggested !== null &&
    (level === "unknown" || levelIndex.indexOf(suggested) > levelIndex.indexOf(level));
  const overlayIds = many(answers, "q14_overlays").filter((id) => id !== "none" && id !== "");
  const overlayLabels = overlayIds.map((id) => OVERLAYS.find((item) => item.id === id)?.label ?? id);

  const c4Items = itemsOf(items, "11a");
  let c4: ItemStatus = weakest(c4Items.map((item) => item.status), "C");
  if (role === "unknown" || role === "") c4 = "Gap";
  else if (role === "decides" && !fullReview) c4 = "Gap";
  else if ((role === "recommends" || role === "info_only") && fullReview && c4Items[0]?.status === "Met") c4 = "Met";
  else if (role === "decides" && fullReview) c4 = weakest([c4, "Partial"], "C");

  const c9 = weakest(["11a", "11b", "11c"].flatMap((id) => itemsOf(items, id).map((item) => item.status)), "C");
  const c6 = weakest(itemsOf(items, "21b").map((item) => item.status), "C");
  const c11 = weakest(["21a", "21c"].flatMap((id) => itemsOf(items, id).map((item) => item.status)), "C");
  const c12 = weakest(itemsOf(items, "23a").map((item) => item.status), "C");

  const groupItems = itemsOf(items, "12e");
  const langItems = itemsOf(items, "12d");
  let c5: ItemStatus;
  if (selectedGroups(answers).length === 0) c5 = "Gap";
  else c5 = weakest([...groupItems, ...langItems].map((item) => item.status), "C");

  let c7: ItemStatus;
  let c8: ItemStatus;
  if (!outsideYes(answers)) {
    c7 = outsideContradiction(answers) || text(answers, "q12_outside") === "" ? "Gap" : "Met";
    c8 = c7;
  } else {
    c7 = weakest(itemsOf(items, "12a").map((item) => item.status), "C");
    c8 = weakest(["12b", "12c"].flatMap((id) => itemsOf(items, id).map((item) => item.status)), "C");
  }

  const c10Parts = ["15a", "15b", "15c", "15d", "16a", "12f"].flatMap((id) => itemsOf(items, id));
  let c10 = weakest(c10Parts.map((item) => item.status), "C");
  if (level === "unknown" || text(answers, "q13_level") === "") c10 = "Gap";

  const rp4 = weakest(
    [...itemsOf(items, "11d").map((item) => item.status), ...itemsOf(items, "11b").map((item) => toRp(item.status))],
    "RP",
  );
  const rp1item = itemsOf(items, "20a");
  let rp1 = weakest(rp1item.map((item) => item.status), "RP");
  if (rp1 === "In place" && text(answers, "q20_harm") === "") rp1 = "Partly in place";
  const rp2 = vendorInvolved(answers)
    ? weakest(itemsOf(items, "16b").map((item) => item.status), "RP")
    : ("Not applicable" as ItemStatus);
  const rp3 = weakest(["14a", "14b", "14c"].flatMap((id) => itemsOf(items, id).map((item) => item.status)), "RP");
  const rp5 = weakest(["22", "22f"].flatMap((id) => itemsOf(items, id).map((item) => item.status)), "RP");
  const rp6 = weakest(["21d", "21e"].flatMap((id) => itemsOf(items, id).map((item) => item.status)), "RP");
  const rp7 = weakest(["23b", "23c"].flatMap((id) => itemsOf(items, id).map((item) => item.status)), "RP");
  const rp8 = weakest(["24a", "24b"].flatMap((id) => itemsOf(items, id).map((item) => item.status)), "RP");

  const q8 = q8Lines(answers);
  const outsideLead = q12OutsideLines(answers);
  const c7Phrase = !outsideYes(answers) && c7 === "Met" ? "no_outside" : c7 === "Met" ? "in_place" : undefined;
  const c8Phrase = !outsideYes(answers) && c8 === "Met" ? "no_outside" : c8 === "Met" ? "in_place" : undefined;
  const c7Items = itemsOf(items, "12a");
  const c8Items = [...itemsOf(items, "12b"), ...itemsOf(items, "12c")];
  const c9Items = ["11a", "11b", "11c"].flatMap((id) => itemsOf(items, id));
  const c10Prefix = level === "unknown" || text(answers, "q13_level") === "" ? "The data level is Unknown (not assigned)." : "";
  const c4Prefix = role === "unknown" || role === "" ? "The decision role is not determined." : role === "decides" && c4 === "Gap" ? "The output decides or acts without a person approving each one." : "";
  const criteria: CriterionResult[] = [
    narrateTo("C1", rights ? "Impact: Yes" : "Impact: No", [], { areas: areaLabels(areas, RIGHTS_AREAS), lead: q8, qRefs: "Q8" }),
    narrateTo("C2", safety ? "Impact: Yes" : "Impact: No", [], { areas: areaLabels(areas, SAFETY_AREAS), lead: q8, qRefs: "Q8" }),
    narrateTo("C3", areas.includes("benefits_services") ? "Impact: Yes" : "Impact: No", [], { lead: q8, qRefs: "Q8" }),
    narrateTo("C4", c4, c4Items, { prefix: c4Prefix, lead: q10Lines(answers), qRefs: "Q10, Q11" }),
    narrateTo("C5", c5, [...groupItems, ...langItems], { qRefs: "Q9, Q12" }),
    narrateTo("C6", c6, itemsOf(items, "21b"), { qRefs: "Q21" }),
    narrateTo("C7", c7, c7Items, { phrase: c7Phrase, prefix: outsideContradiction(answers) ? "Q12 says no one outside the agency is affected, and Q9 names another group." : "", lead: outsideLead, qRefs: "Q12" }),
    narrateTo("C8", c8, c8Items, { phrase: c8Phrase, prefix: outsideContradiction(answers) ? "Q12 says no one outside the agency is affected, and Q9 names another group." : "", lead: outsideLead, qRefs: "Q12" }),
    narrateTo("C9", c9, c9Items, { qRefs: "Q11" }),
    narrateTo("C10", c10, c10Parts, { prefix: c10Prefix, lead: q13Lines(answers), qRefs: "Q13, Q15, Q16" }),
    narrateTo("C11", c11, ["21a", "21c"].flatMap((id) => itemsOf(items, id)), { qRefs: "Q21" }),
    narrateTo("C12", c12, itemsOf(items, "23a"), { qRefs: "Q23" }),
  ];

  const rpResults: CriterionResult[] = [
    narrateTo("RP1", rp1, rp1item, { prefix: rp1 === "Partly in place" && text(answers, "q20_harm") === "" ? "The description of what could go wrong is blank." : "", lead: q20Lines(answers), qRefs: "Q20" }),
    narrateTo("RP2", rp2, itemsOf(items, "16b"), { qRefs: "Q16" }),
    narrateTo("RP3", rp3, ["14a", "14b", "14c"].flatMap((id) => itemsOf(items, id)), { qRefs: "Q14" }),
    narrateTo("RP4", rp4, [...itemsOf(items, "11d"), ...itemsOf(items, "11b")], { qRefs: "Q11" }),
    narrateTo("RP5", rp5, ["22", "22f"].flatMap((id) => itemsOf(items, id)), { qRefs: "Q22" }),
    narrateTo("RP6", rp6, ["21d", "21e"].flatMap((id) => itemsOf(items, id)), { qRefs: "Q21" }),
    narrateTo("RP7", rp7, ["23b", "23c"].flatMap((id) => itemsOf(items, id)), { qRefs: "Q23" }),
    narrateTo("RP8", rp8, ["24a", "24b"].flatMap((id) => itemsOf(items, id)), { qRefs: "Q24" }),
  ];

  const statusById = new Map<string, string>([...criteria, ...rpResults].map((item) => [item.id, item.status]));
  const wellAnswered = ["C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12"].every((id) => statusById.get(id) !== "Gap")
    && ["RP1", "RP2", "RP3", "RP4", "RP5", "RP6", "RP7", "RP8"].every((id) => statusById.get(id) !== "Not yet");

  const triggered = new Map<string, ResolvedItem[]>();
  const addMit = (id: string | null, item?: ResolvedItem) => {
    if (!id || !MITIGATION_BY_ID[id]) return;
    const list = triggered.get(id) ?? [];
    if (item) list.push(item);
    triggered.set(id, list);
  };
  for (const item of items) {
    if (item.notApplicable || !item.mitigation) continue;
    if (item.status === "Met" || item.status === "In place") continue;
    addMit(item.mitigation, item);
  }
  if (prohibited) addMit("M-PROHIBITED");
  const encryptMet = (!showStatement("15a", answers) || itemsOf(items, "15a")[0]?.status === "Met") && itemsOf(items, "15b")[0]?.status === "Met";
  if (encryptMet) triggered.delete("M-ENCRYPT");
  addMit("M-ONGOING");

  const gateIds = new Set(gates.map((item) => item.id));
  const live: LiveMitigation[] = [];
  for (const [id, trig] of triggered) {
    const def = MITIGATION_BY_ID[id];
    const covers = new Set<string>();
    for (const item of trig) {
      for (const feed of item.feeds) {
        if (feed.startsWith("G")) {
          if (gateIds.has(feed)) covers.add(feed);
        } else covers.add(feed);
      }
    }
    if (id === "M-REVIEW" && gateIds.has("G4")) covers.add("G4");
    if (id === "M-REVIEW") {
      if (c9 !== "Met") covers.add("C9");
      if (c4 !== "Met") covers.add("C4");
    }
    if (id === "M-ONGOING") covers.add("C12");
    const quotes = trig
      .filter((item) => item.choiceText)
      .slice(0, 2)
      .map((item) => ({ q: item.legacyQ, text: `${item.context ? `${item.context}: ` : ""}${item.choiceText}` }));
    live.push({
      id,
      title: def.title,
      action: def.action,
      owner: def.owner,
      sources: def.sources,
      remaining: def.remaining,
      timing: pickTiming(def.timing, answers, conflict),
      rpOnly: def.rpOnly,
      covers: [...covers],
      quotes,
    });
  }
  const capped = applyCap(live, wellAnswered);

  const extraFollow: Followup[] = [];
  if (text(answers, "q1_intake") === "") extraFollow.push({ q: 1, text: "Q1: What is the intake reference number for this AI system?", mitigationId: null });
  if (text(answers, "q13_level") === "" || text(answers, "q13_level") === "unknown") {
    extraFollow.push({ q: 13, text: "Q13: What is the highest data level this AI system uses?", mitigationId: "M-PRIVACY" });
  }
  const due = deadline(answers);
  if (due.followup) extraFollow.push({ q: 18, text: "Q18: When was this AI system procured, or was it built by the State?", mitigationId: null });
  if (many(answers, "q7b_prohibited").includes("unknown") && !prohibited) {
    extraFollow.push({ q: 7, text: "Q7: Does any prohibited use in the Responsible AI Policy apply?", mitigationId: null });
  }
  if (selectedGroups(answers).length === 0) extraFollow.push({ q: 9, text: "Q9: Which groups of people are affected?", mitigationId: null });
  if (role === "unknown" || role === "") extraFollow.push({ q: 10, text: "Q10: What role does the output play in decisions?", mitigationId: "M-REVIEW" });
  if (gates.length > 0 && (text(answers, "q11_reviewer") === "" || text(answers, "q11_reviewer").toLowerCase() === "unknown" || review?.unanswered)) {
    extraFollow.push({ q: 11, text: "Q11: Which role reviews the output, and can that role change it or stop the AI system?", mitigationId: "M-REVIEW" });
  }
  let followups = buildFollowups(items, answers, extraFollow);
  const keptIds = new Set(capped.kept.map((item) => item.id));
  followups = followups.map((item) => ({
    ...item,
    mitigationId: item.mitigationId && keptIds.has(item.mitigationId) ? item.mitigationId : item.mitigationId && keptIds.has(preferredBackup(item.q, keptIds)) ? preferredBackup(item.q, keptIds) : null,
  }));

  const confirm: ConfirmFact[] = [];
  const followQs = new Set(followups.map((item) => item.q));
  for (const item of items) {
    if (item.designFact && !followQs.has(item.legacyQ)) {
      confirm.push({ q: 6, text: `Confirm: the design fact that ${item.context || item.title} does not apply (${item.designFact}) (Q6).` });
    }
    if ((item.status === "Met" || item.status === "In place") && item.evidence && !item.evidenceFailed && !followQs.has(item.legacyQ)) {
      confirm.push({ q: item.legacyQ, text: `Confirm: ${item.context || item.title} — ${item.evidence} (Q${item.legacyQ}).` });
    }
  }
  if (due.date && !followQs.has(18)) confirm.push({ q: 18, text: `Confirm: procurement timing is ${labelOf(PROCUREMENT, procurement(answers))} (Q18).` });
  if ((deployment(answers) === "pilot" || deployment(answers) === "live") && text(answers, "q19_prior") === "yes" && !followQs.has(19)) {
    confirm.push({ q: 19, text: "Confirm: an impact assessment was done before deployment (Q19)." });
  }

  let prior: string | null = null;
  const priorValue = text(answers, "q19_prior");
  const priorMissing = priorValue === "no" || priorValue === "unknown" || priorValue === "";
  if ((deployment(answers) === "pilot" || deployment(answers) === "live") && priorMissing) {
    prior = priorValue === "no"
      ? "No impact assessment was done before deployment. This is stated as a fact."
      : "The answers do not show whether an impact assessment was done before deployment. This is stated as a fact.";
  }
  if (conflict && priorMissing) {
    prior = prior ?? "The answers do not show a completed impact assessment before the stated start date. This is stated as a fact.";
  }

  const crossChecks: CrossCheck[] = [];
  if (conflict) {
    crossChecks.push({
      id: "status-conflict",
      proposed: true,
      message: "Q17 says Planning or Procuring, and Q19 gives a start date. Timing in this draft uses Before use until the agency confirms the status.",
    });
  }
  if (outsideContradiction(answers)) {
    crossChecks.push({
      id: "outside-people",
      proposed: true,
      message: "Q12 says no one outside the agency is affected, and Q9 names a group other than State employees.",
    });
  }
  if (g4Cross) {
    crossChecks.push({
      id: "info-only-acts",
      proposed: true,
      message: "Q10 says the output is information only, and Q6 says it is sent to other systems that act on it.",
    });
  }
  if (suggestedHigher && suggested) {
    crossChecks.push({
      id: "level-mismatch",
      proposed: true,
      message: `The data described in Q14 suggests at least ${LEVEL_LABEL[suggested]}. Q13 says ${LEVEL_LABEL[level] ?? level}. Apply the higher safeguards until the agency confirms the level.`,
    });
  }
  if (role === "info_only" && (review?.choiceValue === "none" || review?.choiceValue === "after_only")) {
    crossChecks.push({
      id: "info-only-auto",
      proposed: true,
      message: "Q10 says the output is information only, and Q11 says outputs take effect with no review before they take effect.",
    });
  }

  const inputProblems: string[] = [];
  if (text(answers, "q4_name") === "") inputProblems.push("Q4 AI system name is blank.");
  if (file.form_version && file.form_version !== FORM_VERSION) inputProblems.push(`Form version ${file.form_version} does not match ${FORM_VERSION}.`);

  const responseId = text(answers, "response_id") || `DRAFT-${fingerprint(answers)}`;
  return {
    rulesVersion: RULES_VERSION,
    formVersion: FORM_VERSION,
    fingerprint: fingerprint({ rules: RULES_VERSION, answers }),
    responseId,
    inputProblems,
    prohibited,
    prohibitedLabels,
    prohibitedProposed: combo && prohibitedIds.length === 0,
    area: { rights, safety, label: areaLabel },
    speech,
    gates,
    dataLevel: level,
    dataLevelLabel: LEVEL_LABEL[level] ?? level,
    suggestedLevel: suggestedHigher && suggested ? suggested : null,
    overlays: overlayLabels,
    privacyTrack: privacyTrack(answers),
    criteria,
    rp: rpResults,
    deadlineDate: due.date,
    deadlineLine: due.line,
    summaryDeadline: due.summary,
    priorDeployment: prior,
    crossChecks,
    items,
    mitigations: capped.kept,
    followups,
    confirmFacts: confirm.slice(0, 5),
    wellAnswered,
    capApplied: capped.capApplied,
    attestation: has(answers, "q25_confirm", "confirm"),
    statusConflict: conflict,
  };
}

function preferredBackup(q: number, kept: Set<string>): string {
  const map: Record<number, string[]> = {
    10: ["M-REVIEW"],
    11: ["M-REVIEW", "M-TRAIN"],
    12: ["M-ACCESS", "M-LANG", "M-NOTICE", "M-CONTEST", "M-ABUSE"],
    13: ["M-PRIVACY", "M-ENCRYPT"],
    14: ["M-DATAQ"],
    15: ["M-ENCRYPT", "M-PRIVACY"],
    16: ["M-NOTRAIN", "M-CONTRACT"],
    20: ["M-IMPACT"],
    21: ["M-BIAS", "M-ACCURACY", "M-LOG"],
    22: ["M-SEC"],
    23: ["M-OWNER", "M-INCIDENT"],
    24: ["M-CHANGE"],
  };
  return (map[q] ?? []).find((id) => kept.has(id)) ?? "";
}

export function levelSafeguard(level: string): string {
  return LEVEL_SAFEGUARD[level] ?? LEVEL_SAFEGUARD.unknown ?? "";
}

export function optionLabel(group: "builder" | "role" | "method" | "hosting" | "capability" | "level" | "prior" | "procurement" | "target" | "harm" | "assurance", id: string): string {
  const table = {
    builder: BUILDERS,
    role: ROLES,
    method: METHODS,
    hosting: HOSTING,
    capability: CAPABILITIES,
    level: LEVELS,
    prior: PRIOR,
    procurement: PROCUREMENT,
    target: TARGETS,
    harm: HARM_TYPES,
    assurance: ASSURANCES,
  }[group];
  return labelOf(table, id);
}
