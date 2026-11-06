import type { AssessmentPath } from "../content/types";
import type { Evaluation } from "./model";

export interface FollowStep {
  text: string;
  link: string;
}

export interface BlufCopy {
  sentences: string[];
  steps: FollowStep[];
}

const CROSS_STEPS: Record<string, string> = {
  "status-conflict": "Resolve the clash between the deployment status and the start date in Section 4.",
  "outside-people": "Align who is affected in Section 4, where the group answers disagree.",
  "info-only-acts": "Resolve the clash in Section 4 between information-only use and output sent to other systems.",
  "level-mismatch": "Confirm the data level in Section 4 and apply the higher safeguards until it is confirmed.",
  "info-only-auto": "Resolve the clash in Section 4 between information-only use and outputs with no review.",
};

const FOLLOW_STEPS: Record<number, FollowStep> = {
  1: { link: "sec_1", text: "Record the intake reference in Section 1." },
  7: { link: "sec_4", text: "Say whether a prohibited use applies, as Section 4 records." },
  9: { link: "check_C5", text: "Name the affected groups for C5." },
  10: { link: "check_C4", text: "State the decision role for C4." },
  11: { link: "check_C9", text: "Name who reviews the output for C9." },
  13: { link: "check_C10", text: "Assign the data level for C10." },
  18: { link: "sec_4", text: "Record when the system was procured, as Section 4 uses that date." },
  19: { link: "sec_4", text: "Record whether an impact assessment was done before deployment, as Section 4 states." },
};

function plainName(name: string): string {
  if (/^[A-Z][a-z]/.test(name)) return name.charAt(0).toLowerCase() + name.slice(1);
  return name;
}

function actionKind(status: string): "fail" | "partial" | null {
  if (status === "Gap" || status === "Not yet") return "fail";
  if (status === "Partial" || status === "Partly in place") return "partial";
  return null;
}

function isActionCheck(id: string): boolean {
  return /^C(?:[4-9]|1[0-2])$/.test(id) || /^RP\d+$/.test(id);
}

function lowerFact(value: string): string {
  const trimmed = value.trim().replace(/[.]+$/, "");
  if (!trimmed) return "the path facts are not complete";
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

/** High only because every path reason is an Unknown answer, with no affirmative High fact. */
function forcedByUnknowns(result: Evaluation): boolean {
  return result.path === "high" && result.pathReasons.length > 0 && result.pathReasons.every((item) => item.endsWith("Unknown."));
}

function reason(result: Evaluation): string {
  if (result.path === "prohibited" || result.prohibited) {
    const use = result.prohibitedLabels[0] ?? "a use on the prohibited list";
    return `The single most important reason is a prohibited use: ${use}.`;
  }
  if (forcedByUnknowns(result)) {
    const unknown = result.pathReasons.find((item) => item.endsWith("Unknown.")) ?? "An answer is Unknown.";
    return `The single most important reason is that ${lowerFact(unknown)}.`;
  }
  if (result.statusConflict) {
    return "The single most important reason is that the deployment status and the start date do not agree.";
  }
  const gap = result.criteria.find((item) => item.status === "Gap") ?? result.rp.find((item) => item.status === "Not yet");
  if (gap && isActionCheck(gap.id)) {
    return `The single most important reason is that ${gap.id}, ${plainName(gap.name)}, is not in place.`;
  }
  if (result.priorDeployment) {
    return "The single most important reason is that an impact assessment before deployment is missing or not known.";
  }
  const partial = result.criteria.find((item) => item.status === "Partial") ?? result.rp.find((item) => item.status === "Partly in place");
  if (partial && isActionCheck(partial.id)) {
    return `The single most important reason is that ${partial.id}, ${plainName(partial.name)}, is only partly in place.`;
  }
  if (result.speech) {
    return "The single most important reason is that this use touches speech, assembly or religion and needs named legal authority.";
  }
  const mitigation = result.mitigations.find((item) => item.id !== "M-ONGOING");
  if (mitigation) return `The single most important reason is the open safeguard ${plainName(mitigation.title)}.`;
  if (result.path === "high") {
    const why = result.pathReasons[0];
    if (why) return `The single most important reason is that ${lowerFact(why)}.`;
  }
  if (result.path === "general") {
    return "The single most important reason is that no High or Prohibited fact applies, and this draft does not authorize use.";
  }
  return "The single most important reason is that the path facts are not complete.";
}

export const BLUF_OUTCOME = {
  prohibited: "The outcome is that a prohibited use applies, so the agency stops that use, and this draft is not an approval.",
  highGaps: "The outcome is High, with gaps the agency still has to close.",
  highConditions: "The outcome is High, and it is ready only with conditions.",
  highClean: "The outcome is High, and the coded safeguards are in place, and this draft does not authorize use.",
  generalConditions: "The outcome is General, and it is ready only with conditions.",
  generalClean: "The outcome is General, and the coded safeguards are in place, and this draft does not authorize use.",
  highUnknowns: "The outcome is High because an Unknown answer forces that path.",
  unset: "The outcome is not set, because the path facts are not complete.",
} as const;

function openConditions(result: Evaluation): boolean {
  const checks = [...result.criteria, ...result.rp];
  const failed = checks.some((item) => isActionCheck(item.id) && actionKind(item.status) === "fail");
  const partial = checks.some((item) => isActionCheck(item.id) && actionKind(item.status) === "partial");
  const openMitigation = result.mitigations.some((item) => item.id !== "M-ONGOING");
  return failed || partial || openMitigation || result.speech || result.crossChecks.length > 0 || !result.attestation || result.followups.length > 0 || Boolean(result.priorDeployment) || result.statusConflict;
}

function outcomeSentence(result: Evaluation): string {
  if (result.path === "prohibited" || result.prohibited) return BLUF_OUTCOME.prohibited;
  if (forcedByUnknowns(result)) return BLUF_OUTCOME.highUnknowns;
  if (result.path === "high") {
    const failed = [...result.criteria, ...result.rp].some((item) => isActionCheck(item.id) && actionKind(item.status) === "fail");
    if (failed) return BLUF_OUTCOME.highGaps;
    if (openConditions(result)) return BLUF_OUTCOME.highConditions;
    return BLUF_OUTCOME.highClean;
  }
  if (result.path === "general") {
    if (openConditions(result)) return BLUF_OUTCOME.generalConditions;
    return BLUF_OUTCOME.generalClean;
  }
  return BLUF_OUTCOME.unset;
}

export function pathSentence(path: AssessmentPath): string {
  switch (path) {
    case "high":
      return "The path is High.";
    case "general":
      return "The path is General.";
    case "prohibited":
      return "The path is Prohibited.";
    case "undetermined":
      return "The path is not set yet.";
    default: {
      const never: never = path;
      return never;
    }
  }
}

export function buildBluf(result: Evaluation): BlufCopy {
  const steps: FollowStep[] = [];
  const seen = new Set<string>();
  const add = (text: string, link: string) => {
    const key = `${link}|${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    steps.push({ text, link });
  };
  const linked = (link: string) => steps.some((step) => step.link === link);

  if (result.prohibited) {
    const index = result.mitigations.findIndex((item) => item.id === "M-PROHIBITED");
    if (index >= 0) add("Stop the prohibited use before any use.", `mit_${index + 1}`);
    else add("Stop the prohibited use named in Section 4 before any use.", "sec_4");
  }

  const checks = [...result.criteria, ...result.rp].filter((item) => isActionCheck(item.id));
  for (const kind of ["fail", "partial"] as const) {
    for (const item of checks) {
      if (actionKind(item.status) !== kind) continue;
      const text = kind === "fail"
        ? `Close ${item.id}, ${plainName(item.name)}, which is not in place.`
        : `Finish ${item.id}, ${plainName(item.name)}, which is only partly in place.`;
      add(text, `check_${item.id}`);
    }
  }

  result.mitigations.forEach((mitigation, index) => {
    if (mitigation.id === "M-ONGOING" || mitigation.id === "M-PROHIBITED") return;
    if (mitigation.covers.some((id) => linked(`check_${id}`))) return;
    add(`Complete the safeguard M${index + 1}, ${plainName(mitigation.title)}.`, `mit_${index + 1}`);
  });

  for (const check of result.crossChecks) {
    add(CROSS_STEPS[check.id] ?? `Resolve the ${check.id} note in Section 4.`, "sec_4");
  }
  if (result.priorDeployment) {
    add("Record whether an impact assessment was done before deployment, as Section 4 states.", "sec_4");
  }
  if (result.speech) {
    add("Get named legal authority for this speech, assembly or religion use in Section 4.", "sec_4");
  }
  if (!result.attestation) add("Confirm the attestation and sign the Agency Lead acknowledgment.", "sec_9");

  for (const item of result.followups) {
    const mapped = FOLLOW_STEPS[item.q];
    if (!mapped) continue;
    if (mapped.link.startsWith("check_") && linked(mapped.link)) continue;
    add(mapped.text, mapped.link);
  }

  return {
    sentences: [outcomeSentence(result), pathSentence(result.path), reason(result)],
    steps,
  };
}
