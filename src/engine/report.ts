import { ASSURANCES, BUILDERS, CAPABILITIES, DEPLOYMENT, DESIGN_FACTS, HARM_TYPES, HOSTING, LEVELS, METHODS, PRIOR, PROCUREMENT, ROLES, TARGETS, labelOf } from "../content/catalog";
import { AREAS } from "../content/rules";
import { APPROVAL_BANNED, BANNED, FIXED, RP_META, SOURCES } from "../content/rules";
import { GROUPS, RELATIONS, STATEMENT_BY_ID, THREATS } from "../content/statements";
import type { AnswerFile } from "../content/types";
import type { Answers } from "./answers";
import { many, text } from "./answers";
import { formatIsoDate, reportDateFromSaved } from "./dates";
import { buildBluf, pathSentence, type FollowStep } from "./bluf";
import { certCreditLabels } from "./credits";
import { evaluate, levelSafeguard, optionLabel } from "./evaluate";
import type { Evaluation, LiveMitigation } from "./model";
import { ackFor } from "./signoff";
import { dataLevel, deployment, priorAssessment, processingPlace, procurementApplicable, selectedGroups, statusConflict, threatApplies, vendorInvolved } from "./visibility";

export interface SignField {
  name: string;
  label: string;
  kind: "text" | "multiline" | "signature" | "choice" | "date";
  lines: number;
  /** Radio group. Choice fields that share a group are mutually exclusive. */
  group?: string;
  /** Widget width in points when the field should stay short. */
  width?: number;
  /** Drawn inside a bordered box. Acknowledgments leave this unset. */
  boxed?: boolean;
  /** Prefilled text. Empty means the PDF and Word file keep a blank fillable field. */
  value?: string;
  /** True when this Yes/No choice is the one the agency selected. */
  selected?: boolean;
}

export interface TableRow {
  field: string;
  value: string;
}

export interface Block {
  type: "h1" | "h2" | "h3" | "p" | "label" | "field" | "note" | "qa" | "break" | "bullet" | "sub" | "step" | "sign" | "table";
  text: string;
  source: "template" | "answer" | "slot";
  anchor?: string;
  link?: string;
  fields?: SignField[];
  /** Mitigation id, or "lead" for the Agency Lead block. */
  signId?: string;
  /** Owner and due date lines that sit under a follow-up step. */
  aside?: string;
  /** Two-column Field | Value rows. Used by the High inventory table. */
  rows?: TableRow[];
}

export interface ReportDocument {
  key: "executive" | "evidence" | "submission" | "followup";
  title: string;
  slug: string;
  blocks: Block[];
}

export interface ReportDoc {
  blocks: Block[];
  documents: ReportDocument[];
  systemName: string;
  reportDate: string;
  checks: { id: string; ok: boolean; detail: string }[];
}

/** One document from the package, with the shared running header fields. */
export interface ReportView {
  blocks: Block[];
  systemName: string;
  documentTitle: string;
  reportDate: string;
}

const QUESTIONS: { n: number; section: string; text: string; rp?: string }[] = [
  { n: 1, section: "Section 1: About this request", text: "Intake reference number" },
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

function block(type: Block["type"], text: string, source: Block["source"], extra?: Pick<Block, "anchor" | "link" | "fields" | "signId" | "aside" | "rows">): Block {
  return { type, text, source, ...extra };
}

function sectionAnchor(text: string): string | undefined {
  if (text === "Bottom line up front") return "sec_bluf";
  if (text.startsWith("Appendix:")) return "sec_appendix";
  const match = /^(\d+)\./.exec(text);
  return match ? `sec_${match[1]}` : undefined;
}

function labelAnchor(text: string): string | undefined {
  const check = /^((?:C|RP)\d+)\s/.exec(text);
  if (check) return `check_${check[1]}`;
  const mitigation = /^M(\d+)\s/.exec(text);
  if (mitigation) return `mit_${mitigation[1]}`;
  return undefined;
}

function mitigationSign(file: AnswerFile, mit: LiveMitigation, number: number): Block {
  const ack = ackFor(file, mit.id);
  const choice = ack?.choice === "yes" || ack?.choice === "no" ? ack.choice : "";
  const fields: SignField[] = [
    { name: `ack_${number}_yes`, label: "Yes", kind: "choice", lines: 1, group: `ack_${number}`, width: 12, selected: choice === "yes" },
    { name: `ack_${number}_no`, label: "No", kind: "choice", lines: 1, group: `ack_${number}`, width: 12, selected: choice === "no" },
    { name: `date_${number}`, label: "Date", kind: "date", lines: 1, width: 72, value: ack?.date ?? "" },
    { name: `comment_${number}`, label: "Comment", kind: "multiline", lines: 2, boxed: true, value: ack?.comment ?? "" },
  ];
  return block("sign", `M${number} – ${mit.title}`, "template", { fields, signId: mit.id });
}

function leadSign(file: AnswerFile): Block {
  const signoff = file.signoff;
  const fields: SignField[] = [
    { name: "lead_name", label: "Name", kind: "text", lines: 1, width: 180, boxed: true, value: signoff?.lead_name ?? "" },
    { name: "lead_title", label: "Title (printed role)", kind: "text", lines: 1, width: 180, boxed: true, value: signoff?.lead_title ?? "" },
    { name: "lead_date", label: "Date", kind: "date", lines: 1, width: 120, boxed: true, value: signoff?.lead_date ?? "" },
    { name: "lead_signature", label: "Agency Lead signature", kind: "signature", lines: 2, boxed: true },
  ];
  return block("sign", "Agency Lead sign-off", "template", { fields, signId: "lead" });
}

function creditPhrase(ids: string[]): string {
  return `Credited (in-scope ${certCreditLabels(ids)})`;
}

function evidenceStatus(status: string, lines: { creditCerts?: string[] }[]): string {
  const statements = lines.filter((line) => line.creditCerts !== undefined);
  if (statements.length === 0) return status;
  const allCredited = statements.every((line) => (line.creditCerts ?? []).length > 0);
  if (!allCredited || (status !== "Met" && status !== "In place")) return status;
  const ids = [...new Set(statements.flatMap((line) => line.creditCerts ?? []))];
  return ids.length > 0 ? creditPhrase(ids) : status;
}

function answerBlocks(item: { qRefs: string; answerLines: { label: string; statement: string; evidence: string; targetDate: string; creditCerts?: string[] }[] }): Block[] {
  const lines: Block[] = [block("field", `Answer relied on (${item.qRefs}):`, "answer")];
  const answers = item.answerLines.length > 0 ? item.answerLines : [{ label: "Answer", statement: "No answer provided.", evidence: "", targetDate: "" }];
  for (const line of answers) {
    lines.push(block("bullet", `${line.label}: ${line.statement}`, "answer"));
    if (line.evidence) lines.push(block("sub", `Evidence: ${line.evidence}`, "answer"));
    if (line.targetDate) lines.push(block("sub", `Target date: ${line.targetDate}.`, "answer"));
    if (line.creditCerts && line.creditCerts.length > 0) lines.push(block("sub", `${creditPhrase(line.creditCerts)}.`, "slot"));
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

function inventoryB5(answers: Answers): string {
  const status = deployment(answers);
  const start = text(answers, "q19_start");
  if (status !== "pilot" && status !== "live" && start === "") return FIXED.notDeployed;
  const prior = labelOf(PRIOR, priorAssessment(answers)) || "not answered";
  return `Use started ${start || "start date not given"}. Impact assessment before deployment: ${prior}.`;
}

function inventoryRows(answers: Answers, result: Evaluation): TableRow[] {
  const caps = many(answers, "q6_capabilities").map((id) => labelOf(CAPABILITIES, id));
  const description = text(answers, "q6_description");
  const capabilityValue = [caps.join("; "), description].filter(Boolean).join(". ") || "No answer provided";
  const builder = text(answers, "q5_builder");
  const vendorParts = [text(answers, "q5_vendor"), text(answers, "q5_product"), text(answers, "q5_version")].filter(Boolean);
  const vendorValue = builder === "state_built"
    ? "Not applicable. Built by the State."
    : vendorParts.join(", ") || labelOf(BUILDERS, builder) || "No answer provided";
  const status = deployment(answers);
  const priorAsked = status === "pilot" || status === "live" || statusConflict(answers);
  const priorValue = priorAsked
    ? labelOf(PRIOR, priorAssessment(answers)) || "No answer provided"
    : "Not applicable. Use has not started.";
  return [
    { field: "Name of the system", value: text(answers, "q4_name") || "No answer provided" },
    { field: "Vendor", value: vendorValue },
    { field: "Capabilities", value: capabilityValue },
    { field: "Purpose and intended uses", value: text(answers, "q7_purpose") || "No answer provided" },
    { field: "Impact assessment before deployment", value: priorValue },
    { field: "Decision role", value: optionLabel("role", text(answers, "q10_role")) || "No answer provided" },
    { field: "Summary of this impact assessment", value: buildBluf(result).sentences.join(" ") },
  ];
}

function plainName(name: string): string {
  if (/^[A-Z][a-z]/.test(name)) return name.charAt(0).toLowerCase() + name.slice(1);
  return name;
}

function withPointer(sentence: string, pointer: string): string {
  const trimmed = sentence.trim();
  const base = /[.!?]$/.test(trimmed) ? trimmed.slice(0, -1) : trimmed;
  return `${base} (${pointer}).`;
}

function joinIds(ids: string[]): string {
  if (ids.length === 0) return "";
  if (ids.length === 1) return ids[0];
  if (ids.length === 2) return `${ids[0]} and ${ids[1]}`;
  return `${ids.slice(0, -1).join(", ")}, and ${ids[ids.length - 1]}`;
}

function evidencePointer(ids: string[]): string {
  const usable = ids.filter((id) => /^(?:C|RP|G)\d+$/.test(id));
  if (usable.length === 0) return "";
  return `Evidence, ${joinIds(usable)}`;
}

function pointerForMitigation(mit: LiveMitigation | undefined): string {
  if (mit?.id === "M-PROHIBITED") return "Evidence, Prohibited use";
  const covered = mit ? evidencePointer(mit.covers) : "";
  return covered || "Evidence, Other facts used with the gates";
}

function stepPointer(step: FollowStep, result: Evaluation): string {
  if (step.link.startsWith("check_")) return `Evidence, ${step.link.slice("check_".length)}`;
  if (step.link.startsWith("mit_")) {
    const mitigation = result.mitigations[Number(step.link.slice("mit_".length)) - 1];
    return pointerForMitigation(mitigation);
  }
  if (step.link === "sec_4" && result.prohibited && /prohibited/i.test(step.text)) return "Evidence, Prohibited use";
  if (step.link === "sec_4") return "Evidence, Gates";
  if (step.link === "sec_9") return "Executive Summary, Agency Lead acknowledgment";
  if (step.link === "sec_1") return "Executive Summary, the AI system";
  return "Evidence";
}

function pointedStep(step: FollowStep, result: Evaluation): string {
  return withPointer(step.text, stepPointer(step, result));
}

function mitigationForStep(step: FollowStep, result: Evaluation): LiveMitigation | undefined {
  if (step.link.startsWith("mit_")) return result.mitigations[Number(step.link.slice("mit_".length)) - 1];
  if (step.link.startsWith("check_")) {
    const id = step.link.slice("check_".length);
    return result.mitigations.find((item) => item.covers.includes(id));
  }
  return undefined;
}

function earliestTarget(result: Evaluation, mitigationId: string): string {
  const dates = result.items
    .filter((item) => item.mitigation === mitigationId && item.targetDate)
    .map((item) => item.targetDate)
    .sort();
  return dates[0] ?? "";
}

function stepOwner(step: FollowStep, result: Evaluation): string {
  const mitigation = mitigationForStep(step, result);
  if (mitigation) return mitigation.owner;
  if (step.link === "sec_1" || step.link === "sec_4" || step.link === "sec_9") return "Agency Lead";
  return "";
}

function stepDue(file: AnswerFile, step: FollowStep, result: Evaluation): string {
  const mitigation = mitigationForStep(step, result);
  if (!mitigation) return "";
  const chosen = ackFor(file, mitigation.id)?.date ?? "";
  return formatIsoDate(chosen || earliestTarget(result, mitigation.id));
}

const GATE_CHECKS: { id: string; name: string; checked: string }[] = [
  { id: "G1", name: "benefits, health, housing, financial or legal rights, or employment", checked: "Whether Q8 names benefits, health, housing, money or legal rights, or jobs." },
  { id: "G2", name: "safety", checked: "Whether Q8 names safety or critical infrastructure." },
  { id: "G3", name: "law enforcement, investigation, identification or automated tickets", checked: "Whether Q8 names law enforcement, investigation, identification, or automated tickets. Regulatory inspection alone does not set this gate." },
  { id: "G4", name: "decides or acts without meaningful human review", checked: "Whether the output decides or acts without a person approving each one, review is missing or only a sample, or an information-only answer still sends output to other systems that act on it." },
  { id: "G5", name: "targeting places or groups", checked: "Whether Q8 says the output picks places, areas, or groups." },
  { id: "G6", name: "record matching with possible adverse action", checked: "Whether Q6 matches records and Q8 names an area where that match can lead to action." },
  { id: "G7", name: "decision role or impact unknown", checked: "Whether Q8 or Q10 is unknown." },
];

function findingBlocks(item: { id: string; name: string; status: string; found: string; qRefs: string; answerLines: { label: string; statement: string; evidence: string; targetDate: string; creditCerts?: string[] }[] }, checked: string): Block[] {
  const shown = evidenceStatus(item.status, item.answerLines);
  const lines: Block[] = [
    block("label", `${item.id} – ${item.name}: ${shown}`, "template"),
    block("field", `What was checked: ${checked}`, "template"),
    block("field", `Result: ${shown}.`, "slot"),
    block("field", `What we found: ${item.found}`, "slot"),
    ...answerBlocks(item),
  ];
  return lines;
}

function sourceBlocks(blocks: Block[]): Block[] {
  const cited = citedIds(blocks);
  const lines: Block[] = [];
  for (const source of SOURCES) {
    if (!cited.has(source.id)) continue;
    const url = source.url ? `: ${source.url}` : "";
    lines.push(block("p", `[${source.id}] ${source.name}${url}`, "template"));
  }
  if (lines.length === 0) return [];
  return [block("h2", "Sources", "template"), ...lines];
}

function statusSentence(item: { id: string; name: string; found: string }): string {
  const found = firstSentence(item.found, `${item.id}, ${plainName(item.name)}, is recorded in the answers.`);
  return withPointer(found, `Evidence, ${item.id}`);
}

function banner(file: AnswerFile, blocks: Block[]): void {
  blocks.push(block("note", FIXED.draftBanner, "template"));
  if (file.example) blocks.push(block("note", "Example data. Fictional agency and system.", "template"));
}

function buildExecutive(file: AnswerFile, result: Evaluation, answers: Answers, system: string): Block[] {
  const blocks: Block[] = [];
  blocks.push(block("h1", `Executive Summary: ${system}`, "template"));
  banner(file, blocks);
  blocks.push(block("p", `Response ID: ${result.responseId}`, "slot"));
  blocks.push(block("p", `Report date: ${reportDateFromSaved(file.saved_at).label}.`, "slot"));
  blocks.push(block("h2", "About this summary", "template"));
  for (const paragraph of FIXED.purpose) blocks.push(block("p", paragraph, "template"));
  blocks.push(block("h2", "The AI system", "template", { anchor: "sec_1" }));
  blocks.push(block("p", `AI system (Q4): ${system}`, "answer"));
  blocks.push(block("p", `Agency: ${[text(answers, "q2_agency"), text(answers, "q2_unit")].filter(Boolean).join(", ") || "No answer provided"}`, "answer"));
  const capabilities = many(answers, "q6_capabilities").map((id) => labelOf(CAPABILITIES, id)).join(", ");
  blocks.push(block("p", `Capabilities: ${capabilities || "No answer provided"}`, "answer"));
  blocks.push(block("p", `Purpose: ${text(answers, "q7_purpose") || "No answer provided"}`, "answer"));
  blocks.push(block("p", `Deployment: ${inventoryB5(answers)}`, "answer"));
  blocks.push(block("p", `Decision role: ${optionLabel("role", text(answers, "q10_role")) || "No answer provided"}`, "answer"));
  if (result.path === "high" || result.path === "prohibited") {
    blocks.push(block("p", `Intake reference (Q1): ${text(answers, "q1_intake") || FIXED.noIntake}`, "answer"));
  }
  const areaNames = many(answers, "q8_areas").map((id) => AREAS.find((area) => area.id === id)?.label ?? id).join(", ") || "no area selected";
  blocks.push(block("p", `Affected area: ${areaNames}. This is ${result.area.label}.`, "slot"));
  blocks.push(block("p", result.summaryDeadline, "template"));
  blocks.push(block("p", b7Text(result, answers), "slot", { anchor: "b7" }));
  if (!result.attestation) blocks.push(block("p", "Q25 was not confirmed. The executive summary still needs the Agency Lead's signature.", "template"));

  blocks.push(block("h2", "Bottom line up front", "template"));
  const bluf = buildBluf(result);
  for (const sentence of bluf.sentences) blocks.push(block("p", sentence, "slot"));
  blocks.push(block("h3", "Follow-up steps for the agency", "template"));
  if (bluf.steps.length === 0) blocks.push(block("p", "No follow-up step is open.", "template"));
  else {
    for (const step of bluf.steps) blocks.push(block("step", pointedStep(step, result), "slot", { link: step.link }));
    blocks.push(block("p", "The owner and due date, where the assessment records one, are in Follow-Up Actions.", "template"));
  }

  const checks = [...result.criteria, ...result.rp];
  const well = checks.filter((item) => item.status === "Met" || item.status === "In place");
  const improve = checks.filter((item) => item.status === "Partial" || item.status === "Gap" || item.status === "Partly in place" || item.status === "Not yet");
  const skipped = checks.filter((item) => item.status === "Not applicable");
  blocks.push(block("h2", "What the agency is doing well", "template"));
  if (well.length === 0) blocks.push(block("p", "No coded safeguard is fully in place.", "template"));
  else for (const item of well) blocks.push(block("p", statusSentence(item), "slot"));
  blocks.push(block("h2", "Where there is room for improvement", "template"));
  if (improve.length === 0) blocks.push(block("p", "No coded safeguard is open or only partly in place.", "template"));
  else for (const item of improve) blocks.push(block("p", statusSentence(item), "slot"));
  if (skipped.length) {
    const names = skipped.map((item) => `${item.id}, ${plainName(item.name)} (Evidence, ${item.id})`).join("; ");
    blocks.push(block("p", `These checks do not apply: ${names}.`, "slot"));
  }

  blocks.push(block("h2", "Risks and recommended mitigations", "template"));
  blocks.push(block("p", "Each risk is in plain language. The note in parentheses names the Evidence section with the full check.", "template"));
  const timingGroups = ["Before purchase", "Before use", "Before deployment", "Ongoing"] as const;
  for (const timing of timingGroups) {
    const group = result.mitigations.filter((item) => item.timing === timing);
    if (group.length === 0) continue;
    blocks.push(block("h3", timing, "template"));
    for (const mit of group) {
      const number = result.mitigations.indexOf(mit) + 1;
      const pointer = pointerForMitigation(mit);
      blocks.push(block("label", `M${number} – ${mit.title}`, "template"));
      const action = /[.!?]$/.test(mit.action.trim()) ? mit.action.trim() : `${mit.action.trim()}.`;
      blocks.push(block("p", `${riskLine(mit)} The recommended mitigation is: ${action} The owner is ${mit.owner}. See ${pointer}.`, "slot"));
      blocks.push(mitigationSign(file, mit, number));
    }
  }

  blocks.push(block("h2", "Agency Lead acknowledgment", "template", { anchor: "sec_9" }));
  blocks.push(block("p", FIXED.accuracy, "template"));
  blocks.push(block("p", FIXED.acknowledge, "template"));
  blocks.push(leadSign(file));
  blocks.push(block("p", FIXED.leadNote, "template"));
  blocks.push(block("p", "Sign by hand on the printed copy, or in the signature field of the PDF. The name and date above are the ones entered in the assessment.", "template"));
  blocks.push(...sourceBlocks(blocks));
  if (result.path === "high") {
    blocks.push(block("break", "", "template"));
    blocks.push(block("h2", "Inventory under SF&P § 3.5-803(b)", "template", { anchor: "sec_inventory" }));
    blocks.push(block("table", "", "answer", { rows: inventoryRows(answers, result) }));
  }
  return blocks;
}

function buildEvidence(file: AnswerFile, result: Evaluation, answers: Answers, system: string): Block[] {
  const blocks: Block[] = [];
  blocks.push(block("h1", `Evidence: ${system}`, "template"));
  banner(file, blocks);
  blocks.push(block("p", "This is the reference for the executive summary. Each gate and criteria check records what was checked, the result, and the answers that drove it.", "template"));
  blocks.push(block("h2", "Gates", "template", { anchor: "sec_4" }));
  for (const gate of GATE_CHECKS) {
    const hit = result.gates.find((item) => item.id === gate.id);
    blocks.push(block("label", `${gate.id} – ${gate.name}`, "template", { anchor: `gate_${gate.id}` }));
    blocks.push(block("field", `What was checked: ${gate.checked}`, "template"));
    blocks.push(block("field", hit ? `Result: Set. ${hit.because}` : "Result: Not set. The answers do not meet this gate.", "slot"));
  }
  blocks.push(block("h2", "Other facts used with the gates", "template", { anchor: "sec_facts" }));
  blocks.push(block("label", "Prohibited use", "template", { anchor: "prohibited" }));
  blocks.push(block("field", "What was checked: Whether a prohibited use in the Responsible AI Policy applies.", "template"));
  if (result.prohibited) {
    const labels = result.prohibitedLabels.map((label) => (label.endsWith(".") ? label.slice(0, -1) : label)).join("; ");
    blocks.push(block("field", `Result: Set. ${labels}. The Responsible AI Policy lists this use [P1].`, "slot"));
  } else blocks.push(block("field", "Result: Not set. None selected.", "template"));
  if (result.speech) blocks.push(block("p", "This use touches speech, assembly or religion. It needs named legal authority; refer to agency counsel.", "template"));
  const levelLine = dataLevel(answers) === "unknown"
    ? "Data level: Unknown (not assigned). A missing data level is itself a gap. The privacy track is open (PTA; PIA if the State Chief Privacy Officer directs) [P4]."
    : `Data level and safeguards: ${levelSafeguard(dataLevel(answers))}`;
  blocks.push(block("p", levelLine, "template"));
  if (result.suggestedLevel) blocks.push(block("p", `The data described in Q14 suggests at least ${result.suggestedLevel}. Apply that level's safeguards until the agency confirms the level [P3].`, "slot"));
  if (result.overlays.length) blocks.push(block("p", `${result.overlays.join(", ")} applies, so the stricter of State policy and that overlay applies [P3].`, "slot"));
  if (result.privacyTrack && dataLevel(answers) !== "unknown") blocks.push(block("p", "The privacy track is open: PTA, and a PIA if the State Chief Privacy Officer directs [P4].", "template"));
  for (const check of result.crossChecks) blocks.push(block("p", check.message, "slot"));
  if (result.priorDeployment) blocks.push(block("p", result.priorDeployment, "slot"));
  blocks.push(block("p", result.deadlineLine, "template"));

  blocks.push(block("h2", "Criteria", "template"));
  for (const item of result.criteria) {
    const kind = item.id === "C1" || item.id === "C2" || item.id === "C3" ? "whether this impact is present" : "the safeguard statements and evidence for this criterion";
    blocks.push(...findingBlocks(item, `${item.name}: ${kind}.`));
  }
  blocks.push(block("h3", "Recommended practice checks (ISO/IEC 42001 and ISO/IEC 27090)", "template"));
  blocks.push(block("p", "These checks are recommendations. They are not Maryland law and not DoIT policy.", "template"));
  for (const item of result.rp) {
    const aligned = RP_META.find((row) => row.id === item.id)?.aligned ?? "";
    blocks.push(...findingBlocks(item, `${item.name}: the recommended-practice statements and any evidence the agency gave.`));
    blocks.push(block("field", `Aligned to: ${aligned}`, "template"));
  }
  blocks.push(...sourceBlocks(blocks));
  return blocks;
}

function buildSubmission(file: AnswerFile, result: Evaluation, answers: Answers, system: string): Block[] {
  const blocks: Block[] = [];
  const when = reportDateFromSaved(file.saved_at).label;
  blocks.push(block("h1", `Assessment Submission Record: ${system}`, "template"));
  banner(file, blocks);
  blocks.push(block("p", `AI system: ${system}`, "answer"));
  blocks.push(block("p", `Submission date: ${file.saved_at ? when : "not submitted to DoIT"}.`, "answer"));
  blocks.push(block("p", FIXED.appendixNote.replace("{id}", result.responseId).replace("{when}", file.saved_at ? when : "not submitted to DoIT"), "template"));
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
  return blocks;
}

function buildFollowUp(file: AnswerFile, result: Evaluation, system: string): Block[] {
  const blocks: Block[] = [];
  const bluf = buildBluf(result);
  blocks.push(block("h1", `Follow-Up Actions: ${system}`, "template"));
  banner(file, blocks);
  blocks.push(block("p", "Each step is one sentence. The owner and due date are shown when this assessment records them. The note in parentheses names the Evidence section.", "template"));
  blocks.push(block("h2", "Follow-up steps", "template"));
  if (bluf.steps.length === 0) blocks.push(block("p", "No follow-up step is open.", "template"));
  for (const step of bluf.steps) {
    const owner = stepOwner(step, result);
    const due = stepDue(file, step, result);
    const aside = [owner ? `Owner: ${owner}.` : "", due ? `Due date: ${due}.` : ""].filter(Boolean).join("\n");
    blocks.push(block("step", pointedStep(step, result), "slot", { link: step.link, aside: aside || undefined }));
  }
  return blocks;
}

function b7Text(result: Evaluation, answers: Answers): string {
  const name = text(answers, "q4_name") || "The AI system";
  const purpose = firstSentence(text(answers, "q7_purpose"), "Its purpose is in the agency's answers.");
  const open = result.mitigations.filter((item) => item.id !== "M-ONGOING").map((item) => item.title);
  const openText = open.length ? `Still to plan: ${open.join("; ")}.` : "The answers show the main safeguards in place.";
  const pathLine = pathSentence(result.path).replace(/\.$/, "");
  let textValue = `${name} supports this purpose: ${purpose} ${pathLine}, in an area that is ${result.area.label}. ${openText} The Agency Lead will plan the mitigations in this report and reassess at least yearly. This public summary leaves out security settings.`;
  const parts = textValue.split(/(?<=[.])\s+/);
  while (words(textValue) > 150 && parts.length > 1) {
    parts.pop();
    textValue = parts.join(" ");
  }
  return textValue;
}

export function reportFileStem(systemName: string): string {
  const safe = systemName.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return safe || "assessment";
}

export function documentView(doc: ReportDoc, part: ReportDocument): ReportView {
  return {
    blocks: part.blocks,
    systemName: doc.systemName,
    documentTitle: part.title,
    reportDate: doc.reportDate,
  };
}

export function buildReport(file: AnswerFile): ReportDoc {
  const answers = file.answers ?? {};
  const result = evaluate(file);
  const system = text(answers, "q4_name") || "Unnamed AI system";
  const documents: ReportDocument[] = [
    { key: "executive", title: "Executive Summary", slug: "1-Executive-Summary", blocks: buildExecutive(file, result, answers, system) },
    { key: "evidence", title: "Evidence", slug: "2-Evidence", blocks: buildEvidence(file, result, answers, system) },
    { key: "submission", title: "Assessment Submission Record", slug: "3-Assessment-Submission-Record", blocks: buildSubmission(file, result, answers, system) },
    { key: "followup", title: "Follow-Up Actions", slug: "4-Follow-Up-Actions", blocks: buildFollowUp(file, result, system) },
  ];
  const blocks = documents.flatMap((part) => part.blocks);
  for (const item of blocks) {
    if (item.type === "h2" && !item.anchor) item.anchor = sectionAnchor(item.text);
    if (item.type === "label" && !item.anchor) item.anchor = labelAnchor(item.text);
  }
  return {
    blocks,
    documents,
    systemName: system,
    reportDate: reportDateFromSaved(file.saved_at).label,
    checks: selfCheck(blocks, result, answers),
  };
}

function citedIds(blocks: Block[]): Set<string> {
  const ids = new Set<string>();
  const body = blocks.map((item) => item.text).join("\n");
  for (const match of body.matchAll(/\[([A-Z]\d)\]/g)) ids.add(match[1]);
  return ids;
}

function blockPlain(item: Block): string {
  const rows = (item.rows ?? []).flatMap((row) => [row.field, row.value]);
  return [item.text, ...rows].filter((part) => part !== "").join("\n");
}

export function reportPlainText(doc: ReportDoc): string {
  return doc.blocks
    .map((item) => (item.type === "break" ? "" : blockPlain(item)))
    .filter((line) => line !== "")
    .join("\n\n");
}

export function selfCheck(blocks: Block[], result: Evaluation, answers: Answers): { id: string; ok: boolean; detail: string }[] {
  const textValue = blocks.map((item) => blockPlain(item)).join("\n");
  const lower = textValue.toLowerCase();
  const bannedHit = BANNED.filter((word) => {
    if (word === "quiet" || word === "quietly") return new RegExp(`\\b${word}\\b`, "i").test(textValue);
    return lower.includes(word);
  });
  const approval = APPROVAL_BANNED.filter((word) => textValue.includes(word));
  if (/\bApproved\b/.test(textValue)) approval.push("Approved");
  const email = text(answers, "q3_email");
  const ongoing = result.mitigations.filter((item) => item.timing === "Ongoing");
  const b7Block = blocks.find((item) => item.anchor === "b7");
  const live = text(answers, "q17_status") === "live" && !result.statusConflict;
  const planning = (text(answers, "q17_status") === "planning" || text(answers, "q17_status") === "procuring") && !result.statusConflict;
  const badTiming = result.mitigations.filter((item) => {
    if (live && (item.timing === "Before purchase" || item.timing === "Before deployment")) return true;
    if (planning && item.timing === "Before use") return true;
    return false;
  });
  const unsourced = blocks.filter((item) => item.type !== "break" && !item.source);
  const blufStart = blocks.findIndex((item) => item.text === "Bottom line up front");
  const nextHeading = blocks.findIndex((item, index) => index > blufStart && item.type === "h2");
  const blufSlice = blufStart >= 0 && nextHeading > blufStart ? blocks.slice(blufStart, nextHeading) : [];
  const followAt = blufSlice.findIndex((item) => item.text === "Follow-up steps for the agency");
  const takeawayText = blufSlice.slice(0, Math.max(followAt, 0)).filter((item) => item.type === "p").map((item) => item.text).join(" ");
  const takeawaySentences = takeawayText.split(/(?<=[.!?])\s+/).filter(Boolean);
  const stepBlocks = blufSlice.filter((item) => item.type === "step");
  const nothingOpen = blufSlice.some((item) => item.text === "No follow-up step is open.");
  const anchors = new Set(blocks.flatMap((item) => item.anchor ? [item.anchor] : []));
  const everyStep = blocks.filter((item) => item.type === "step");
  const brokenLinks = everyStep.filter((item) => !item.link || !anchors.has(item.link));
  const stepPeriods = everyStep.filter((item) => (item.text.match(/[.!?]/g) ?? []).length !== 1);
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
    { id: "section9", ok: blocks.filter((item) => item.type === "sign" && item.fields?.some((field) => field.kind === "choice" && field.label === "Yes") && item.fields?.some((field) => field.kind === "choice" && field.label === "No")).length === result.mitigations.length, detail: "One Yes/No acknowledgment per mitigation." },
    { id: "q25-followup", ok: !result.followups.some((item) => item.q === 25), detail: "No Q25 follow-up." },
    { id: "cap", ok: !result.wellAnswered || result.mitigations.length <= 3, detail: `${result.mitigations.length} mitigations; well answered: ${result.wellAnswered}.` },
    { id: "tags", ok: !textValue.includes("[P1] Implementation Guidance") && !/\[P2\] Responsible AI Policy(?! Implementation)/.test(textValue), detail: "P1 and P2 tags match their names." },
    { id: "bluf", ok: blufStart > 0 && followAt > 0 && takeawaySentences.length === 3 && /The path is (?:High|General|Prohibited|not set yet)\./.test(takeawayText) && takeawayText.includes("The outcome is") && takeawayText.includes("The single most important reason is") && !takeawayText.includes("The risk level is High-risk."), detail: `${takeawaySentences.length} sentences.` },
    { id: "follow-steps", ok: (stepBlocks.length > 0) !== nothingOpen && stepPeriods.length === 0, detail: stepBlocks.length ? `${stepBlocks.length} steps.` : "No follow-up step is open." },
    { id: "links", ok: brokenLinks.length === 0, detail: brokenLinks.map((item) => item.link ?? item.text).join(", ") || "Follow-up steps link to a section or check." },
  ];
}

export { QUESTIONS };
