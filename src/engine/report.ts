import { ASSURANCES, BUILDERS, CAPABILITIES, DEPLOYMENT, DESIGN_FACTS, HARM_TYPES, HOSTING, LEVELS, METHODS, PRIOR, PROCUREMENT, ROLES, TARGETS, labelOf } from "../content/catalog";
import { AREAS } from "../content/rules";
import { APPROVAL_BANNED, BANNED, FIXED, RP_META, SOURCES } from "../content/rules";
import { GROUPS, RELATIONS, STATEMENT_BY_ID, THREATS } from "../content/statements";
import type { AnswerFile } from "../content/types";
import type { Answers } from "./answers";
import { many, text } from "./answers";
import { evaluate, levelSafeguard, optionLabel } from "./evaluate";
import type { Evaluation, LiveMitigation } from "./model";
import { dataLevel, deployment, priorAssessment, processingPlace, procurementApplicable, selectedGroups, statusConflict, threatApplies, vendorInvolved } from "./visibility";

export interface Block {
  type: "h1" | "h2" | "h3" | "p" | "label" | "field" | "note" | "qa" | "break" | "bullet" | "sub";
  text: string;
  source: "template" | "answer" | "slot";
}

export interface ReportDoc {
  blocks: Block[];
  systemName: string;
  checks: { id: string; ok: boolean; detail: string }[];
}

const QUESTIONS: { n: number; section: string; text: string; rp?: string }[] = [
  { n: 1, section: "Section 1: About this request", text: "Intake reference number (from your High-risk intake result)" },
  { n: 2, section: "Section 1: About this request", text: "Your agency or unit, and your role" },
  { n: 3, section: "Section 1: About this request", text: "Are you the Agency Lead who will acknowledge the report? If not, give the Agency Lead's role and email." },
  { n: 4, section: "Section 2: The AI system", text: "Name of the AI system" },
  { n: 5, section: "Section 2: The AI system", text: "Who built it? Name the vendor, product and version, and any part your agency built or changed. If there is no vendor, write \"Built by the State.\"" },
  { n: 6, section: "Section 2: The AI system", text: "What can the AI system do? Include the model or method it uses and where it runs." },
  { n: 7, section: "Section 2: The AI system", text: "What is its purpose, and how will your agency use it? Describe the current process it changes." },
  { n: 8, section: "Section 2: The AI system", text: "Which areas could its output affect, and how? For example: benefits or services, health, housing, money or legal rights, jobs, safety, law enforcement, or speech, assembly or religion." },
  { n: 9, section: "Section 2: The AI system", text: "Who is affected? Name the groups, including any who may need extra care, such as children, older adults, people with disabilities, people with limited English or low-income residents." },
  { n: 10, section: "Section 3: Decisions and oversight", text: "What role does the output play in decisions?" },
  { n: 11, section: "Section 3: Decisions and oversight", text: "Who reviews the output, and can they change or stop it? How are changes recorded? What training and instructions will staff get on its limits and when to check its output?", rp: "RP4" },
  { n: 12, section: "Section 3: Decisions and oversight", text: "How are affected people told AI is involved, and how can they reach a person, fix their data or challenge a result? Include languages offered. Write \"Not applicable\" if no one outside your agency is affected." },
  { n: 13, section: "Section 4: Data and vendor", text: "Highest data level the AI system uses (Data Classification Policy)" },
  { n: 14, section: "Section 4: Data and vendor", text: "What data does it use, learn from or pull into answers? Say where the data comes from, how you check its quality and guard it from tampering, and any special rules (for example, HIPAA, FERPA, CJIS, IRS Pub 1075 or SSA).", rp: "RP3" },
  { n: 15, section: "Section 4: Data and vendor", text: "Where is the data processed and stored, and how long is it kept? Is it encrypted at rest and in transit? What is the status of the privacy review (PTA or PIA)?" },
  { n: 16, section: "Section 4: Data and vendor", text: "For vendor products: Can the vendor use State data to train its models? What assurances has it given (such as SOC 2, FedRAMP, StateRAMP, ISO/IEC 27001 or 42001)? Does the contract say who is responsible for what and require notice of model changes and AI security incidents? Write \"Not applicable\" if built by the State.", rp: "RP2" },
  { n: 17, section: "Section 5: Status", text: "Deployment status" },
  { n: 18, section: "Section 5: Status", text: "When was it procured?" },
  { n: 19, section: "Section 5: Status", text: "If it is in pilot or live: When did use start, and was an impact assessment done before it was deployed? Write \"Not applicable\" if not in use yet." },
  { n: 20, section: "Section 6: Risks and safeguards", text: "What could go wrong? Describe likely misuse, how the AI system could fail or get results wrong, and who is harmed or bears the cost when it does.", rp: "RP1" },
  { n: 21, section: "Section 6: Risks and safeguards", text: "How do you test and monitor accuracy, errors, drift and whether results differ across groups? Include what you log (such as model version) and how often you re-test, including after model updates.", rp: "RP6" },
  { n: 22, section: "Section 6: Risks and safeguards", text: "What AI security protections are in place or planned? Cover prompt injection, poisoned data, model theft, data leaking through outputs, unsafe outputs passed to other systems, and any security testing such as red teaming. Write \"None yet\" if none.", rp: "RP5" },
  { n: 23, section: "Section 6: Risks and safeguards", text: "By role: Who monitors the AI system, handles incidents, tells affected people about an incident (how and how fast) and leads reassessment? How can staff raise concerns outside the team that runs it?", rp: "RP7" },
  { n: 24, section: "Section 6: Risks and safeguards", text: "What changes would make you re-check this assessment (for example, a new model version, new data, new tools or permissions, or a new use)? What happens to the models, data and logs when the AI system is retired?", rp: "RP8" },
  { n: 25, section: "Section 7: Attestation", text: "I confirm these answers are accurate to the best of my knowledge, and I understand this form is not approval." },
];

function block(type: Block["type"], text: string, source: Block["source"]): Block {
  return { type, text, source };
}

function answerBlocks(item: { qRefs: string; answerLines: { label: string; statement: string; evidence: string; targetDate: string }[] }): Block[] {
  const lines: Block[] = [block("field", `Answer relied on (${item.qRefs}):`, "answer")];
  const answers = item.answerLines.length > 0 ? item.answerLines : [{ label: "Answer", statement: "No answer provided.", evidence: "", targetDate: "" }];
  for (const line of answers) {
    lines.push(block("bullet", `${line.label}: ${line.statement}`, "answer"));
    if (line.evidence) lines.push(block("sub", `Evidence: ${line.evidence}`, "answer"));
    if (line.targetDate) lines.push(block("sub", `Target date: ${line.targetDate}.`, "answer"));
  }
  return lines;
}

function words(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function firstSentence(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const match = trimmed.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : trimmed).trim();
}

function statementLines(answers: Answers, legacyQ: number): string[] {
  const lines: string[] = [];
  for (const item of Object.values(STATEMENT_BY_ID)) {
    if (item.legacyQ !== legacyQ) continue;
    const keys = Object.keys(answers).filter((key) => key === `st${item.id}` || key.startsWith(`st${item.id}__`));
    const valueKeys = keys.filter((key) => !key.endsWith("__evidence") && !key.endsWith("__date"));
    if (item.id !== "12e" && item.id !== "16b" && item.id !== "22") {
      const value = text(answers, `st${item.id}`);
      if (!value) continue;
      const choice = item.choices.find((row) => row.value === value);
      lines.push(`${item.title}: ${choice?.text ?? value}`);
      const evidence = text(answers, `st${item.id}__evidence`);
      const date = text(answers, `st${item.id}__date`);
      if (evidence) lines.push(`Evidence: ${evidence}`);
      if (date) lines.push(`Target date: ${date}`);
    } else {
      for (const key of valueKeys) {
        const value = text(answers, key);
        if (!value) continue;
        if (item.id === "22") {
          const threatId = key.slice("st22__".length);
          if (THREATS.some((threat) => threat.id === threatId) && !threatApplies(threatId, answers)) continue;
        }
        const choice = item.choices.find((row) => row.value === value);
        const suffix = key.slice(`st${item.id}__`.length);
        const context = suffix && suffix !== item.id ? suffix.replaceAll("_", " ") : "";
        lines.push(`${item.title}${context ? ` (${context})` : ""}: ${choice?.text ?? value}`);
        const evidence = text(answers, `${key}__evidence`);
        const date = text(answers, `${key}__date`);
        if (evidence) lines.push(`Evidence: ${evidence}`);
        if (date) lines.push(`Target date: ${date}`);
      }
    }
  }
  return lines;
}

export function appendixAnswer(answers: Answers, n: number): string {
  const lines: string[] = [];
  const push = (label: string, value: string) => {
    if (value.trim()) lines.push(`${label}: ${value.trim()}`);
  };
  if (n === 1) push("Intake reference", text(answers, "q1_intake"));
  if (n === 2) {
    push("Agency", text(answers, "q2_agency"));
    push("Unit", text(answers, "q2_unit"));
    push("Role", text(answers, "q2_role"));
  }
  if (n === 3) {
    const lead = text(answers, "q3_is_lead");
    if (lead === "yes") lines.push("The submitter is the Agency Lead.");
    if (lead === "no") {
      lines.push("The submitter is not the Agency Lead.");
      push("Agency Lead role", text(answers, "q3_lead_role"));
    }
  }
  if (n === 4) push("AI system name", text(answers, "q4_name"));
  if (n === 5) {
    push("Who built it", labelOf(BUILDERS, text(answers, "q5_builder")));
    push("Vendor", text(answers, "q5_vendor"));
    push("Product", text(answers, "q5_product"));
    push("Version", text(answers, "q5_version"));
    push("Agency changes", text(answers, "q5_changes"));
  }
  if (n === 6) {
    const caps = many(answers, "q6_capabilities").map((id) => labelOf(CAPABILITIES, id));
    if (caps.length) lines.push(`Capabilities: ${caps.join("; ")}`);
    const facts = many(answers, "q6_design_facts").map((id) => labelOf(DESIGN_FACTS, id));
    if (facts.length) lines.push(`Design facts: ${facts.join("; ")}`);
    push("Method", labelOf(METHODS, text(answers, "q6_method")));
    push("Where it runs", labelOf(HOSTING, text(answers, "q6_hosting")));
    push("Description", text(answers, "q6_description"));
  }
  if (n === 7) {
    const uses = many(answers, "q7b_prohibited");
    if (uses.length) lines.push(`Prohibited-use checklist: ${uses.join("; ")}`);
    push("Purpose and process", text(answers, "q7_purpose"));
  }
  if (n === 8) {
    push("Areas", many(answers, "q8_areas").join("; "));
    push("What the output picks", labelOf(TARGETS, text(answers, "q8_target")));
    push("How", text(answers, "q8_how"));
  }
  if (n === 9) {
    for (const id of selectedGroups(answers)) {
      const name = GROUPS.find((group) => group.id === id)?.label ?? id;
      const relation = labelOf(RELATIONS.map((item) => ({ id: item.id, label: item.label })), text(answers, `q9_rel__${id}`));
      lines.push(`${name}: ${relation || "No relation selected"}`);
    }
    push("Other groups", text(answers, "q9_other"));
  }
  if (n === 10) push("Role in decisions", labelOf(ROLES, text(answers, "q10_role")));
  if (n === 11) {
    push("Reviewer role", text(answers, "q11_reviewer"));
    lines.push(...statementLines(answers, 11));
  }
  if (n === 12) {
    const outside = text(answers, "q12_outside");
    if (outside) lines.push(`People outside the agency are affected: ${outside === "yes" ? "Yes" : "No"}`);
    lines.push(...statementLines(answers, 12));
  }
  if (n === 13) push("Data level", labelOf(LEVELS, text(answers, "q13_level")));
  if (n === 14) {
    push("Data types", many(answers, "q14_data_types").join("; "));
    push("Overlays", many(answers, "q14_overlays").join("; "));
    push("Sources", text(answers, "q14_sources"));
    lines.push(...statementLines(answers, 14));
  }
  if (n === 15) {
    const place = processingPlace(answers);
    const placeLabel = labelOf(HOSTING, place.id);
    push("Where processed", place.sameAsRun && placeLabel ? `${placeLabel} (same place it runs)` : placeLabel);
    lines.push(...statementLines(answers, 15));
  }
  if (n === 16) {
    if (!vendorInvolved(answers)) lines.push("Not applicable. Built by the State with no outside model or vendor.");
    push("Assurances", many(answers, "q16_assurances").map((id) => labelOf(ASSURANCES, id)).join("; "));
    const scope = text(answers, "q16_cert_scope");
    if (scope) push("Certificate scope covers the product", scope);
    lines.push(...statementLines(answers, 16));
  }
  if (n === 17) push("Deployment status", labelOf(DEPLOYMENT, text(answers, "q17_status")));
  if (n === 18) {
    if (!procurementApplicable(answers)) lines.push("Not applicable. Built by the State with no vendor and no outside model.");
    else push("Procurement", labelOf(PROCUREMENT, text(answers, "q18_procured")));
  }
  if (n === 19) {
    const asked = deployment(answers) === "pilot" || deployment(answers) === "live";
    if (!asked && !statusConflict(answers)) {
      lines.push("Impact assessment before deployment: Not applicable. Use has not started.");
    } else {
      push("Start of use", text(answers, "q19_start"));
      push("Impact assessment before deployment", labelOf(PRIOR, priorAssessment(answers)));
    }
  }
  if (n === 20) {
    push("What could go wrong", text(answers, "q20_harm"));
    push("Harm types", many(answers, "q20_types").map((id) => labelOf(HARM_TYPES, id)).join("; "));
    lines.push(...statementLines(answers, 20));
  }
  if (n === 21) lines.push(...statementLines(answers, 21));
  if (n === 22) {
    for (const threat of THREATS) {
      if (!threatApplies(threat.id, answers)) {
        lines.push(`${threat.label}: Excluded because of the Q6 answers. The agency did not select Does not apply.`);
      }
    }
    lines.push(...statementLines(answers, 22));
  }
  if (n === 23) {
    push("Monitoring role", text(answers, "q23_monitor"));
    push("Incident role", text(answers, "q23_incident"));
    push("Reassessment role", text(answers, "q23_reassess"));
    lines.push(...statementLines(answers, 23));
  }
  if (n === 24) lines.push(...statementLines(answers, 24));
  if (n === 25) lines.push(many(answers, "q25_confirm").includes("confirm") || text(answers, "q25_confirm") === "confirm" ? "I confirm" : "");
  const joined = lines.map((line) => line.trim()).filter(Boolean).join("\n");
  return joined || "No answer provided";
}

function riskLine(mit: LiveMitigation): string {
  const covers = mit.covers.length ? ` (${mit.covers.join(", ")})` : "";
  const quote = mit.quotes[0];
  const statement = quote ? `Q${quote.q}, ${quote.text.replace(/[.]+$/, "")}` : "The answers leave this safeguard open";
  if (mit.id === "M-ONGOING") {
    return `Ongoing checks cover the safeguards this report adds or the answers already describe, including yearly reassessment${covers}.`;
  }
  if (mit.id === "M-PROHIBITED") {
    return `The Responsible AI Policy lists a prohibited use [P1]. ${statement}${covers}.`;
  }
  const body = `${statement}${covers}.`;
  return mit.rpOnly ? `Recommended practice: ${body}` : body;
}

function gather(mit: LiveMitigation): string {
  if (mit.id === "M-NOTRAIN" || mit.id === "M-CONTRACT") return "The signed contract clause, or the draft clause and the target award date.";
  if (mit.id === "M-ENCRYPT") return "A short confirmation from agency information security that encryption and access limits are in place.";
  if (mit.id === "M-PRIVACY") return "The PTA, and the PIA if one was directed.";
  if (mit.id === "M-BIAS" || mit.id === "M-ACCURACY") return "The test record: data used, criteria, date and result.";
  if (mit.id === "M-PROHIBITED") return "A record of how the prohibited function was removed or stopped.";
  return "The record named in the answer, or the target date and the role who will finish the work.";
}

function doneWhen(mit: LiveMitigation): string {
  if (mit.id === "M-ONGOING") return "A named role runs the checks at least yearly and after model updates.";
  if (mit.id === "M-PROHIBITED") return "The prohibited function is removed or stopped, and that fact is recorded.";
  return "The safeguard is in place, or a dated plan is recorded and owned.";
}

function inventoryB2(answers: Answers): string {
  const parts = [labelOf(BUILDERS, text(answers, "q5_builder"))];
  for (const [label, key] of [["Vendor", "q5_vendor"], ["Product", "q5_product"], ["Version", "q5_version"], ["Agency changes", "q5_changes"]] as const) {
    const value = text(answers, key);
    if (value) parts.push(`${label}: ${value}`);
  }
  return parts.filter(Boolean).join(". ");
}

function inventoryB5(answers: Answers): string {
  const status = deployment(answers);
  const start = text(answers, "q19_start");
  if (status !== "pilot" && status !== "live" && start === "") return FIXED.notDeployed;
  const prior = labelOf(PRIOR, priorAssessment(answers)) || "not answered";
  return `Use started ${start || "start date not given"}. Impact assessment before deployment: ${prior}.`;
}

function summaryText(result: Evaluation, answers: Answers): string {
  const name = text(answers, "q4_name") || "This AI system";
  const agency = text(answers, "q2_agency") || "the agency";
  const purpose = firstSentence(text(answers, "q7_purpose"), "The purpose is described in the agency's answers.");
  const gaps = result.criteria.filter((item) => item.status === "Gap").map((item) => item.id);
  const gapSentence = gaps.length ? `Open gaps include ${gaps.join(", ")}.` : "No C4 to C12 item is a Gap.";
  const mits = result.mitigations.map((item) => item.title).slice(0, 3).join("; ");
  return [
    `${name} is a High-risk AI system at ${agency}. ${purpose}`,
    `The area is ${result.area.label}. ${gapSentence}`,
    `The main mitigations are: ${mits || "none beyond the items already in place"}.`,
    "The Agency Lead plans each mitigation and signs Section 9.",
    result.summaryDeadline,
  ].join(" ");
}

function b7Text(result: Evaluation, answers: Answers): string {
  const name = text(answers, "q4_name") || "The AI system";
  const purpose = firstSentence(text(answers, "q7_purpose"), "Its purpose is in the agency's answers.");
  const open = result.mitigations.filter((item) => item.id !== "M-ONGOING").map((item) => item.title);
  const openText = open.length ? `Still to plan: ${open.join("; ")}.` : "The answers show the main safeguards in place.";
  let textValue = `${name} supports this purpose: ${purpose} It is High-risk because intake found it so, in an area that is ${result.area.label}. ${openText} The Agency Lead will plan the mitigations in this report and reassess at least yearly. This public summary leaves out security settings.`;
  const parts = textValue.split(/(?<=[.])\s+/);
  while (words(textValue) > 150 && parts.length > 1) {
    parts.pop();
    textValue = parts.join(" ");
  }
  return textValue;
}

export function buildReport(file: AnswerFile): ReportDoc {
  const answers = file.answers ?? {};
  const result = evaluate(file);
  const system = text(answers, "q4_name") || "Unnamed AI system";
  const blocks: Block[] = [];
  const example = file.example ? "Example data. Fictional agency and system." : "";
  blocks.push(block("h1", `Algorithmic Impact Assessment: ${system}`, "template"));
  blocks.push(block("note", FIXED.draftBanner, "template"));
  if (example) blocks.push(block("note", example, "template"));
  blocks.push(block("p", `Response ID: ${result.responseId}`, "slot"));
  blocks.push(block("p", `Intake reference (Q1): ${text(answers, "q1_intake") || FIXED.noIntake}`, "answer"));
  blocks.push(block("p", `AI system (Q4): ${system}`, "answer"));

  blocks.push(block("h2", "1. Summary", "template"));
  if (text(answers, "q1_intake") === "") blocks.push(block("p", FIXED.noIntake, "template"));
  blocks.push(block("p", summaryText(result, answers), "slot"));

  blocks.push(block("h2", "2. Purpose of this assessment", "template"));
  for (const paragraph of FIXED.purpose) blocks.push(block("p", paragraph, "template"));

  blocks.push(block("h2", "3. The AI system and inventory record", "template"));
  const fields: [string, string][] = [
    ["(b1) Name", system],
    ["(b2) Developer and version", inventoryB2(answers)],
    ["(b3) Capabilities", text(answers, "q6_description") || many(answers, "q6_capabilities").map((id) => labelOf(CAPABILITIES, id)).join("; ") || "No answer provided"],
    ["(b4) Purpose", text(answers, "q7_purpose") || "No answer provided"],
    ["(b5) Deployment date or status", inventoryB5(answers)],
    ["(b6) Decision role", optionLabel("role", text(answers, "q10_role")) || "No answer provided"],
    ["(b7) Inventory summary", "see Section 8"],
    ["Agency", [text(answers, "q2_agency"), text(answers, "q2_unit")].filter(Boolean).join(", ") || "No answer provided"],
    ["Intake reference", text(answers, "q1_intake") || FIXED.noIntake],
    ["Deployment status", labelOf(DEPLOYMENT, deployment(answers)) || "No answer provided"],
    ...(procurementApplicable(answers) ? [["Procurement date", labelOf(PROCUREMENT, text(answers, "q18_procured")) || "No answer provided"] as [string, string]] : []),
    ["Submitter role", text(answers, "q2_role") || "No answer provided"],
    ["Agency Lead role", text(answers, "q3_is_lead") === "yes" ? (text(answers, "q2_role") || "Submitter") : (text(answers, "q3_lead_role") || "Not named")],
  ];
  for (const [label, value] of fields) blocks.push(block("p", `${label}: ${value}`, "answer"));
  if (!result.attestation) blocks.push(block("p", "Q25 was not confirmed. Section 9 still needs the Agency Lead's signature.", "template"));

  blocks.push(block("h2", "4. Why this AI system is High-risk", "template"));
  blocks.push(block("p", "The intake found this AI system High-risk.", "template"));
  const areaNames = many(answers, "q8_areas").map((id) => AREAS.find((area) => area.id === id)?.label ?? id).join(", ") || "no area selected";
  blocks.push(block("p", `High-risk area: ${areaNames}. This is ${result.area.label} (SF&P § 3.5-801) [S1].`, "slot"));
  if (text(answers, "q8_how")) blocks.push(block("p", `How the agency describes the effect: ${text(answers, "q8_how")}`, "answer"));
  if (result.gates.length === 0) blocks.push(block("p", "No risk gate was set from the coded answers.", "template"));
  for (const item of result.gates) blocks.push(block("p", `${item.id}: ${item.name}. ${item.because}`, "slot"));
  if (result.speech) blocks.push(block("p", "This use touches speech, assembly or religion. It needs named legal authority; refer to agency counsel.", "template"));
  const levelLine = dataLevel(answers) === "unknown"
    ? "Data level: Unknown (not assigned). A missing data level is itself a gap. The privacy track is open (PTA; PIA if the State Chief Privacy Officer directs) [P4]."
    : `Data level and safeguards: ${levelSafeguard(dataLevel(answers))}`;
  blocks.push(block("p", levelLine, "template"));
  if (result.suggestedLevel) {
    blocks.push(block("p", `The data described in Q14 suggests at least ${result.suggestedLevel}. Apply that level's safeguards until the agency confirms the level [P3].`, "slot"));
  }
  if (result.overlays.length) {
    blocks.push(block("p", `${result.overlays.join(", ")} applies, so the stricter of State policy and that overlay applies [P3].`, "slot"));
  }
  if (result.privacyTrack && dataLevel(answers) !== "unknown") {
    blocks.push(block("p", "The privacy track is open: PTA, and a PIA if the State Chief Privacy Officer directs [P4].", "template"));
  }
  if (result.prohibited) {
    blocks.push(block("p", `The Responsible AI Policy lists this as a prohibited use [P1]: ${result.prohibitedLabels.join("; ")}. Resolve it before any use. This report does not approve or reject the AI system.`, "slot"));
  }
  for (const check of result.crossChecks) blocks.push(block("p", check.message, "slot"));
  if (result.priorDeployment) blocks.push(block("p", result.priorDeployment, "slot"));
  blocks.push(block("p", result.deadlineLine, "template"));

  blocks.push(block("h2", "5. Findings by criterion", "template"));
  for (const item of result.criteria) {
    blocks.push(block("label", `${item.id} – ${item.name}: ${item.status}`, "template"));
    blocks.push(block("field", `What we found: ${item.found}`, "slot"));
    blocks.push(...answerBlocks(item));
  }
  blocks.push(block("h3", "Recommended practice checks (ISO/IEC 42001 and ISO/IEC 27090)", "template"));
  blocks.push(block("p", "These checks are recommendations. They are not Maryland law and not DoIT policy.", "template"));
  for (const item of result.rp) {
    const aligned = RP_META.find((row) => row.id === item.id)?.aligned ?? "";
    blocks.push(block("label", `${item.id} – ${item.name}: ${item.status}`, "template"));
    blocks.push(block("field", `What we found: ${item.found}`, "slot"));
    blocks.push(...answerBlocks(item));
    blocks.push(block("field", `Aligned to: ${aligned}`, "template"));
  }

  blocks.push(block("h2", "6. Risks and recommended mitigations", "template"));
  const timingGroups = ["Before purchase", "Before use", "Before deployment", "Ongoing"] as const;
  for (const timing of timingGroups) {
    const group = result.mitigations.filter((item) => item.timing === timing);
    if (group.length === 0) continue;
    blocks.push(block("h3", timing, "template"));
    group.forEach((mit, index) => {
      const number = result.mitigations.indexOf(mit) + 1;
      blocks.push(block("label", `M${number} – ${mit.title}`, "template"));
      blocks.push(block("field", `Risk: ${riskLine(mit)}`, "slot"));
      blocks.push(block("field", `Action: ${mit.action}`, "template"));
      blocks.push(block("field", `Owner: ${mit.owner}. Source: ${mit.sources.map((id) => `[${id}]`).join(" ")}.`, "template"));
      blocks.push(block("field", `Remaining risk: ${mit.remaining}`, "template"));
      void index;
    });
  }

  blocks.push(block("h2", "7. Agency Follow-Up", "template"));
  blocks.push(block("p", FIXED.followupOpener, "template"));
  let f = 1;
  const placed = new Set<number>();
  result.mitigations.forEach((mit, index) => {
    const number = index + 1;
    const related = result.followups.filter((item) => item.mitigationId === mit.id);
    for (const item of related) placed.add(item.q);
    blocks.push(block("label", `F${f} – ${mit.title}`, "template"));
    blocks.push(block("field", `For: M${number}${mit.covers.length ? `, ${mit.covers.join(", ")}` : ""}.`, "slot"));
    blocks.push(block("field", `What to gather: ${gather(mit)}`, "template"));
    blocks.push(block("field", `Likely owner: ${mit.owner}.`, "template"));
    const questions = related.map((item) => item.text);
    questions.push("Who will do the work, and what date will you put in Section 9?");
    blocks.push(block("field", `Questions to work through: ${questions.map((item, i) => `${i + 1}. ${item}`).join(" ")}`, "slot"));
    blocks.push(block("field", `Done when: ${doneWhen(mit)}`, "template"));
    f += 1;
  });
  for (const item of result.followups.filter((row) => !placed.has(row.q))) {
    blocks.push(block("label", `F${f} – Follow-up on Q${item.q}`, "template"));
    blocks.push(block("field", `For: Q${item.q}.`, "template"));
    blocks.push(block("field", "What to gather: The missing answer and the record that supports it.", "template"));
    blocks.push(block("field", "Likely owner: Agency Lead.", "template"));
    blocks.push(block("field", `Questions to work through: 1. ${item.text}`, "slot"));
    blocks.push(block("field", "Done when: The answer is recorded and, if it changes a finding, the assessment is updated.", "template"));
    f += 1;
  }
  if (result.confirmFacts.length) {
    blocks.push(block("label", "Confirm the facts this report relies on", "template"));
    blocks.push(block("field", `For: ${result.confirmFacts.map((item) => `Q${item.q}`).join(", ")}.`, "slot"));
    blocks.push(block("field", "What to gather: Your own records that back each fact below.", "template"));
    blocks.push(block("field", "Likely owner: Agency Lead.", "template"));
    blocks.push(block("field", `Questions to work through: ${result.confirmFacts.map((item, i) => `${i + 1}. ${item.text}`).join(" ")}`, "answer"));
    blocks.push(block("field", "Done when: The Agency Lead has checked each fact before signing Section 9. If a fact is wrong or changes, the agency updates its answers and this assessment.", "template"));
  }

  blocks.push(block("h2", "8. Inventory summary (b7)", "template"));
  blocks.push(block("p", b7Text(result, answers), "slot"));

  blocks.push(block("break", "section-9", "template"));
  blocks.push(block("h2", "9. Agency Lead acknowledgment", "template"));
  result.mitigations.forEach((mit, index) => {
    blocks.push(block("label", `M${index + 1} – ${mit.title}`, "template"));
    blocks.push(block("field", "Acknowledged (Yes / No): ________", "template"));
    blocks.push(block("field", "Our plan and target date: ________________________", "template"));
    blocks.push(block("field", "Comment: ________________________", "template"));
  });
  blocks.push(block("p", FIXED.accuracy, "template"));
  blocks.push(block("p", FIXED.acknowledge, "template"));
  blocks.push(block("p", "Agency Lead signature ____ Printed role ____ Agency ____ Date ____", "template"));
  blocks.push(block("p", FIXED.leadNote, "template"));

  blocks.push(block("h2", "10. Sources", "template"));
  const cited = citedIds(blocks);
  for (const source of SOURCES) {
    if (!cited.has(source.id)) continue;
    const url = source.url ? `: ${source.url}` : "";
    blocks.push(block("p", `[${source.id}] ${source.name}${url}`, "template"));
  }

  blocks.push(block("break", "appendix", "template"));
  blocks.push(block("h2", "Appendix: Questions and answers used in this assessment", "template"));
  const when = file.saved_at || "not submitted to DoIT";
  blocks.push(block("p", FIXED.appendixNote.replace("{id}", result.responseId).replace("{when}", when), "template"));
  let section = "";
  for (const question of QUESTIONS) {
    if (question.section !== section) {
      section = question.section;
      blocks.push(block("h3", section, "template"));
    }
    blocks.push(block("label", `Q${question.n}. ${question.text}`, "template"));
    if (question.rp) blocks.push(block("note", `Recommended practice (${question.rp}): good practice, not a State rule`, "template"));
    blocks.push(block("qa", appendixAnswer(answers, question.n), "answer"));
  }

  return { blocks, systemName: system, checks: selfCheck(blocks, result, answers) };
}

function citedIds(blocks: Block[]): Set<string> {
  const ids = new Set<string>();
  const body = blocks.map((item) => item.text).join("\n");
  for (const match of body.matchAll(/\[([A-Z]\d)\]/g)) ids.add(match[1]);
  return ids;
}

export function reportPlainText(doc: ReportDoc): string {
  return doc.blocks
    .map((item) => {
      if (item.type === "break") return "";
      if (item.type === "h1") return item.text;
      if (item.type === "h2" || item.type === "h3") return item.text;
      return item.text;
    })
    .filter((line) => line !== "")
    .join("\n\n");
}

export function selfCheck(blocks: Block[], result: Evaluation, answers: Answers): { id: string; ok: boolean; detail: string }[] {
  const textValue = blocks.map((item) => item.text).join("\n");
  const lower = textValue.toLowerCase();
  const bannedHit = BANNED.filter((word) => {
    if (word === "quiet" || word === "quietly") return new RegExp(`\\b${word}\\b`, "i").test(textValue);
    return lower.includes(word);
  });
  const approval = APPROVAL_BANNED.filter((word) => textValue.includes(word));
  if (/\bApproved\b/.test(textValue)) approval.push("Approved");
  const email = text(answers, "q3_email");
  const ongoing = result.mitigations.filter((item) => item.timing === "Ongoing");
  const section8Index = blocks.findIndex((item) => item.text.startsWith("8. Inventory"));
  const b7Block = blocks[section8Index + 1];
  const live = text(answers, "q17_status") === "live" && !result.statusConflict;
  const planning = (text(answers, "q17_status") === "planning" || text(answers, "q17_status") === "procuring") && !result.statusConflict;
  const badTiming = result.mitigations.filter((item) => {
    if (live && (item.timing === "Before purchase" || item.timing === "Before deployment")) return true;
    if (planning && item.timing === "Before use") return true;
    return false;
  });
  const unsourced = blocks.filter((item) => item.type !== "break" && !item.source);
  return [
    { id: "sourced", ok: unsourced.length === 0, detail: "Every block has a template, answer or slot source." },
    { id: "banned", ok: bannedHit.length === 0, detail: bannedHit.join(", ") || "No banned words." },
    { id: "approval", ok: approval.length === 0 && !textValue.includes("## Recommendation"), detail: approval.join(", ") || "No approval language." },
    { id: "email", ok: email === "" || !textValue.includes(email), detail: "Agency Lead email is not in the report." },
    { id: "ongoing", ok: ongoing.length === 1, detail: `${ongoing.length} Ongoing mitigation(s).` },
    { id: "deadline", ok: result.deadlineLine.includes("[S2]") && textValue.includes(result.summaryDeadline), detail: result.deadlineLine },
    { id: "b7", ok: Boolean(b7Block) && words(b7Block?.text ?? "") <= 150, detail: `${words(b7Block?.text ?? "")} words.` },
    { id: "tables", ok: !textValue.includes("| ---"), detail: "No table markup in the body." },
    { id: "timing", ok: badTiming.length === 0, detail: badTiming.map((item) => item.id).join(", ") || "Timings match deployment status." },
    { id: "section9", ok: (textValue.match(/Acknowledged \(Yes \/ No\)/g) ?? []).length === result.mitigations.length, detail: "One acknowledgment block per mitigation." },
    { id: "q25-followup", ok: !result.followups.some((item) => item.q === 25), detail: "No Q25 follow-up." },
    { id: "cap", ok: !result.wellAnswered || result.mitigations.length <= 3, detail: `${result.mitigations.length} mitigations; well answered: ${result.wellAnswered}.` },
    { id: "tags", ok: !textValue.includes("[P1] Implementation Guidance") && !/\[P2\] Responsible AI Policy(?! Implementation)/.test(textValue), detail: "P1 and P2 tags match their names." },
  ];
}

export { QUESTIONS };
