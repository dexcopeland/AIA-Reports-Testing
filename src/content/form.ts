import {
  ASSURANCES,
  BUILDERS,
  CAPABILITIES,
  DEPLOYMENT,
  DESIGN_FACTS,
  HARM_TYPES,
  HOSTING,
  LEVELS,
  METHODS,
  PRIOR,
  PROCUREMENT,
  ROLES,
  TARGETS,
  YES_NO,
  labelOf,
} from "./catalog";
import { AREAS, DATA_TYPES, OVERLAYS, PROHIBITED } from "./rules";
import { CONTRACT_TERMS, GROUPS, THREATS } from "./statements";
import type { Answers } from "../engine/answers";
import { text } from "../engine/answers";
import { assuranceSelected, certCreditActive, shortenedFieldIds } from "../engine/credits";
import { deriveAssessmentPath } from "../engine/path";
import { selectedGroups, showProcessingPlace, showStatement, threatApplies, vendorInvolved } from "../engine/visibility";

/** all: shared front. gate: facts that set the path. core: General short set, also shown on High. high: High and Prohibited only. */
export type FieldAudience = "all" | "gate" | "core" | "high";

export interface Field {
  id: string;
  legacyQ: number;
  type: "short" | "paragraph" | "radio" | "check" | "statement" | "groups" | "email" | "date" | "info";
  label: string;
  help?: string;
  required?: boolean;
  options?: { id: string; label: string }[];
  statementId?: string;
  repeat?: "group" | "term" | "threat";
  show?: (answers: Answers) => boolean;
  legend?: (answers: Answers) => string;
  role?: boolean;
  autocomplete?: string;
  spellcheck?: boolean;
  /** Which path shows this field. Omitted fields are treated as high-only. */
  audience?: FieldAudience;
}

export interface FormSection {
  id: string;
  title: string;
  fields: Field[];
}

const leadNo = (answers: Answers) => text(answers, "q3_is_lead") === "no";
const notState = (answers: Answers) => text(answers, "q5_builder") !== "state_built" && text(answers, "q5_builder") !== "";
const stateBuilt = (answers: Answers) => text(answers, "q5_builder") === "state_built";
const inPilotOrLive = (answers: Answers) => text(answers, "q17_status") === "pilot" || text(answers, "q17_status") === "live";

export function samePlaceLabel(answers: Answers): string {
  const place = labelOf(HOSTING, text(answers, "q6_hosting"));
  const named = place && place !== text(answers, "q6_hosting") ? place : "the place named in Q6";
  return `Is the data processed in the same place it runs (${named})?`;
}
const certPicked = (answers: Answers) => vendorInvolved(answers) && assuranceSelected(answers);

export const FIELD_AUDIENCE: Record<string, FieldAudience> = {
  q1_intake: "high",
  q2_agency: "all",
  q2_unit: "all",
  q2_role: "all",
  q3_is_lead: "all",
  q3_lead_role: "all",
  q3_email: "all",
  q4_name: "all",
  q5_builder: "all",
  q5_vendor: "all",
  q5_product: "all",
  q5_version: "all",
  q5_changes: "all",
  q6_capabilities: "gate",
  q6_design_facts: "high",
  q6_method: "high",
  q6_hosting: "high",
  q6_description: "high",
  q7_purpose: "all",
  q7b_prohibited: "gate",
  q8_areas: "gate",
  q8_target: "gate",
  q8_how: "high",
  q9_groups: "core",
  q9_other: "core",
  q10_role: "gate",
  q11_reviewer: "high",
  st11a: "core",
  st11b: "high",
  st11c: "high",
  st11d: "high",
  q12_outside: "core",
  st12a: "core",
  st12b: "high",
  st12c: "high",
  st12d: "high",
  st12e: "high",
  st12f: "high",
  q13_level: "core",
  q14_data_types: "core",
  q14_overlays: "core",
  q14_sources: "high",
  st14a: "high",
  st14b: "high",
  st14c: "high",
  q15_same_place: "high",
  q15_where: "high",
  st15a: "core",
  st15b: "core",
  st15c: "high",
  st15d: "high",
  q16_note: "core",
  st16a: "core",
  q16_assurances: "core",
  q16_cert_scope: "core",
  q16_credit_note: "core",
  st16b: "high",
  q17_status: "high",
  q18_procured: "high",
  q19_start: "high",
  q19_prior: "high",
  q20_harm: "core",
  q20_types: "core",
  st20a: "high",
  st21a: "core",
  st21b: "core",
  st21c: "high",
  st21d: "high",
  st21e: "high",
  st22: "high",
  st22f: "high",
  q23_monitor: "core",
  q23_incident: "core",
  q23_reassess: "high",
  st23a: "core",
  st23b: "high",
  st23c: "high",
  st24a: "high",
  st24b: "high",
  q25_confirm: "core",
};

function audienceVisible(audience: FieldAudience, answers: Answers): boolean {
  const path = deriveAssessmentPath(answers).path;
  switch (audience) {
    case "all":
    case "gate":
      return true;
    case "core":
      return path === "general" || path === "high" || path === "prohibited";
    case "high":
      return path === "high" || path === "prohibited";
    default: {
      const never: never = audience;
      return never;
    }
  }
}

export const SECTIONS: FormSection[] = [
  {
    id: "about",
    title: "Section 1: About this request",
    fields: [
      { id: "q1_intake", legacyQ: 1, type: "short", label: "Intake reference number", audience: "high", help: "Optional. If this system already has an intake reference, record it. Leave this blank if you do not. This number does not set the path.", autocomplete: "off", spellcheck: false },
      { id: "q2_agency", legacyQ: 2, type: "short", label: "Agency", required: true, help: "The agency that owns this AI system.", autocomplete: "organization" },
      { id: "q2_unit", legacyQ: 2, type: "short", label: "Unit", required: true, help: "The office or unit inside the agency." },
      { id: "q2_role", legacyQ: 2, type: "short", label: "Your role", required: true, role: true, help: "A role, such as program manager. Do not write a person's name." },
      { id: "q3_is_lead", legacyQ: 3, type: "radio", label: "Are you the Agency Lead who will acknowledge the report?", required: true, options: YES_NO, help: "The Agency Lead signs the acknowledgment in the executive summary even if someone else fills in this form." },
      { id: "q3_lead_role", legacyQ: 3, type: "short", label: "Agency Lead role", required: true, role: true, show: leadNo, help: "Role only. The report does not name a person." },
      { id: "q3_email", legacyQ: 3, type: "email", label: "Agency Lead email", required: true, show: leadNo, autocomplete: "email", spellcheck: false, help: "Used only if your agency later chooses to contact the Agency Lead. It is saved in the answers file and is never written into the report." },
    ],
  },
  {
    id: "system",
    title: "Section 2: The AI system",
    fields: [
      { id: "q4_name", legacyQ: 4, type: "short", label: "Name of the AI system", required: true, help: "The name staff use. This becomes the report title. This is example-safe public inventory text: leave out security settings." },
      { id: "q5_builder", legacyQ: 5, type: "radio", label: "Who built it?", required: true, options: BUILDERS, help: "Built by the State means no vendor and no outside model. An outside model API is not the same thing." },
      { id: "q5_vendor", legacyQ: 5, type: "short", label: "Vendor", show: notState, help: "Copied into the inventory record." },
      { id: "q5_product", legacyQ: 5, type: "short", label: "Product", show: notState },
      { id: "q5_version", legacyQ: 5, type: "short", label: "Version", show: notState },
      { id: "q5_changes", legacyQ: 5, type: "short", label: "What the agency built or changed", help: "Settings, connections or added steps. Write none if nothing was changed." },
      { id: "q6_capabilities", legacyQ: 6, type: "check", label: "What can the AI system do?", required: true, audience: "gate", options: CAPABILITIES, help: "Pick every capability that is true today. Identifying people from body features, or ranking individual people, can set High when the output is also a basis for a decision. A public chat does not set High by itself. Example: a chat window for residents is not High on its own. Matching a face to a case file can be." },
      { id: "q6_design_facts", legacyQ: 6, type: "check", label: "Which design facts are true today?", options: DESIGN_FACTS, help: "Pick only facts you can point to. They can excuse a specific security threat. They never excuse human review, bias testing, accuracy, accountability or the data level." },
      { id: "q6_method", legacyQ: 6, type: "radio", label: "Method", required: true, options: METHODS },
      { id: "q6_hosting", legacyQ: 6, type: "radio", label: "Where it runs", required: true, options: HOSTING },
      { id: "q6_description", legacyQ: 6, type: "paragraph", label: "Describe what it does, the method and where it runs", required: true, help: "This is copied word for word into the inventory and the appendix. Do not put security settings here." },
      { id: "q7_purpose", legacyQ: 7, type: "paragraph", label: "Purpose and the process it changes", required: true, help: "What problem it solves, how the work is done today, and what changes when staff use it." },
      { id: "q7b_prohibited", legacyQ: 7, type: "check", label: "Does the AI system do any of these?", required: true, audience: "gate", options: [...PROHIBITED.map((item) => ({ id: item.id, label: item.label })), { id: "none", label: "None of these" }, { id: "unknown", label: "Unknown" }], help: "This v1 list has the two examples named in the current rules, plus none and unknown. It is not the full Prohibited Uses list. A listed use sets the path to Prohibited. Unknown sets High. None of these leaves this question off the High path. The report still does not approve or reject the system." },
      { id: "q8_areas", legacyQ: 8, type: "check", label: "Which areas could its output affect?", required: true, audience: "gate", options: AREAS, help: "A rights area plus a decision basis sets High. A safety area sets High on its own. Choose None of these when no listed area applies. Example: ordering benefit files is a rights area. A park mowing forecast is None of these. Unknown sets High. Data level, a public chat, a vendor product, or deciding alone does not set High." },
      { id: "q8_target", legacyQ: 8, type: "radio", label: "What does the output pick, rank or act on?", required: true, audience: "gate", options: TARGETS, help: "Places or groups can set gate G5. Ranking individual people does not set G5 by itself. Ranking individual people, together with a decision basis, can set High even without a rights area. Ranking places does not. Example: ranking applicants is individual ranking. Ranking park maps is not." },
      { id: "q8_how", legacyQ: 8, type: "short", label: "How could the output affect those areas?", help: "A short line. It is quoted and not scored." },
      { id: "q9_groups", legacyQ: 9, type: "groups", label: "Who is affected?", required: true, audience: "core", options: GROUPS, help: "For each group, say whether they use the system, the output acts on them one by one, or they are affected only in general." },
      { id: "q9_other", legacyQ: 9, type: "short", label: "Other groups", audience: "core", help: "Optional. Name any group the list missed." },
      { id: "q10_role", legacyQ: 10, type: "radio", label: "What role does the output play in decisions?", required: true, audience: "gate", options: ROLES, help: "A basis means the output decides or staff use it to decide, including a recommendation. Information only is not a basis. Example: a supervisor uses a score to order files. That is a basis. A number on a staff screen that nobody acts on is not. Deciding alone, with no rights or safety area, does not set High. Unknown sets High." },
    ],
  },
  {
    id: "decisions",
    title: "Section 3: Decisions and oversight",
    fields: [
      { id: "q11_reviewer", legacyQ: 11, type: "short", label: "Which role reviews the output?", required: true, role: true, help: "Write Unknown if the role is not decided. Use a role, not a person's name." },
      { id: "st11a", legacyQ: 11, type: "statement", statementId: "11a", label: "Human review before an output takes effect", required: true },
      { id: "st11b", legacyQ: 11, type: "statement", statementId: "11b", label: "Power to change or stop", required: true },
      { id: "st11c", legacyQ: 11, type: "statement", statementId: "11c", label: "Overrides recorded", required: true },
      { id: "st11d", legacyQ: 11, type: "statement", statementId: "11d", label: "Staff instructions and training", required: true, help: "Recommended practice (RP4): good practice, not a State rule." },
      { id: "q12_outside", legacyQ: 12, type: "radio", label: "Are people outside the agency affected?", required: true, options: YES_NO, help: "Say yes if residents, businesses or other non-employees are affected, even if they never see the AI system." },
      { id: "st12a", legacyQ: 12, type: "statement", statementId: "12a", label: "Telling people AI is involved", required: true, show: (answers) => showStatement("12a", answers) },
      { id: "st12b", legacyQ: 12, type: "statement", statementId: "12b", label: "Reaching a person", required: true, show: (answers) => showStatement("12b", answers) },
      { id: "st12c", legacyQ: 12, type: "statement", statementId: "12c", label: "Fixing data and challenging a result", required: true, show: (answers) => showStatement("12c", answers) },
      { id: "st12d", legacyQ: 12, type: "statement", statementId: "12d", label: "Language access", required: true, show: (answers) => showStatement("12d", answers) },
      { id: "st12e", legacyQ: 12, type: "statement", statementId: "12e", repeat: "group", label: "Access path for each named group", required: true, show: (answers) => selectedGroups(answers).length > 0 },
      { id: "st12f", legacyQ: 12, type: "statement", statementId: "12f", label: "Safety for people at risk of abuse", required: true, show: (answers) => showStatement("12f", answers) },
    ],
  },
  {
    id: "data",
    title: "Section 4: Data and vendor",
    fields: [
      { id: "q13_level", legacyQ: 13, type: "radio", label: "Highest data level", required: true, options: LEVELS, help: "The level sets safeguards. It does not decide whether the system is High-risk." },
      { id: "q14_data_types", legacyQ: 14, type: "check", label: "Which kinds of data does it use?", required: true, options: DATA_TYPES, help: "The rules suggest a minimum level from these types and compare it with Q13." },
      { id: "q14_overlays", legacyQ: 14, type: "check", label: "Special rules (overlays)", required: true, options: OVERLAYS },
      { id: "q14_sources", legacyQ: 14, type: "short", label: "Where does the data come from?", help: "A short list of sources. Copied into the appendix." },
      { id: "st14a", legacyQ: 14, type: "statement", statementId: "14a", label: "Data sources and quality checks", required: true, help: "Recommended practice (RP3): good practice, not a State rule." },
      { id: "st14b", legacyQ: 14, type: "statement", statementId: "14b", label: "Protecting data from tampering", required: true },
      { id: "st14c", legacyQ: 14, type: "statement", statementId: "14c", label: "Limits on documents pulled into answers", required: true, show: (answers) => showStatement("14c", answers) },
      {
        id: "q15_same_place",
        legacyQ: 15,
        type: "radio",
        label: "Is the data processed in the same place it runs?",
        legend: samePlaceLabel,
        required: true,
        options: YES_NO,
        help: "Yes uses the place named in Q6. No asks for the processing place. If an older file names a different place, this question is left unanswered and that place stays on screen until you choose Yes or No.",
      },
      { id: "q15_where", legacyQ: 15, type: "radio", label: "Where is the data processed?", required: true, options: HOSTING, show: showProcessingPlace },
      { id: "st15a", legacyQ: 15, type: "statement", statementId: "15a", label: "Encryption at rest and in transit", required: true, show: (answers) => showStatement("15a", answers), help: "Shown for Level 2 and above, and when the level is Unknown." },
      { id: "st15b", legacyQ: 15, type: "statement", statementId: "15b", label: "Access limited to authorized staff", required: true },
      { id: "st15c", legacyQ: 15, type: "statement", statementId: "15c", label: "Privacy review", required: true, show: (answers) => showStatement("15c", answers), help: "Shown when the privacy track is open: Level 3, Level 4, Unknown, or an overlay." },
      { id: "st15d", legacyQ: 15, type: "statement", statementId: "15d", label: "Retention", required: true, help: "Proposed item. DoIT has not signed off on this mapping." },
      { id: "q16_note", legacyQ: 16, type: "info", label: "Vendor terms do not apply", show: (answers) => text(answers, "q5_builder") === "state_built", help: "Q5 is built by the State with no outside model, so the vendor statements stay hidden and RP2 is not applicable." },
      { id: "st16a", legacyQ: 16, type: "statement", statementId: "16a", label: "Vendor use of State data for training", required: true, show: (answers) => showStatement("16a", answers) },
      { id: "q16_assurances", legacyQ: 16, type: "check", label: "Assurances the vendor has given", show: (answers) => vendorInvolved(answers), options: ASSURANCES, help: "Pick every certificate the vendor has given. The next question asks whether it covers this product, for every certificate, not only ISO. An in-scope certificate can shorten overlapping questions and soften the related risk. It cannot move High to General, and it does not skip human review, data level, prohibited use, training on State data, document limits, accuracy testing for this workflow, or deployment approval. A certificate does not by itself satisfy the contract-term statements." },
      { id: "q16_cert_scope", legacyQ: 16, type: "radio", label: "Does the certificate scope cover this product?", show: certPicked, options: [...YES_NO, { id: "unknown", label: "Unknown" }], help: "Yes means the certificate's stated scope includes this product. No or Unknown gives no credit. Credit never changes a High path to General." },
      { id: "q16_credit_note", legacyQ: 16, type: "info", label: "In-scope certificates shorten overlapping questions", show: certCreditActive, help: "Access, encryption, logging, security threats, and some AI-management questions stay off this screen when the matching certificate covers this product. Saved answers remain in the file. Human review, data level, prohibited use, training on State data, document limits, accuracy for this workflow, and deployment approval stay on screen." },
      { id: "st16b", legacyQ: 16, type: "statement", statementId: "16b", repeat: "term", label: "Contract terms", required: true, show: (answers) => showStatement("16b", answers), help: "Recommended practice (RP2). One set for each term. A certificate alone never counts as the signed term." },
    ],
  },
  {
    id: "status",
    title: "Section 5: Status",
    fields: [
      { id: "q17_status", legacyQ: 17, type: "radio", label: "Deployment status", required: true, options: DEPLOYMENT },
      { id: "q18_procured", legacyQ: 18, type: "radio", label: "When was it procured?", required: true, options: PROCUREMENT, show: (answers) => !stateBuilt(answers), help: "Hidden when Q5 is built by the State with no vendor and no outside model. Unknown uses the no-date sentence. That option is proposed." },
      { id: "q19_start", legacyQ: 19, type: "date", label: "When did use start?", show: inPilotOrLive, help: "Shown for Pilot and Live. A start date saved with Planning or Procuring still flags a conflict when an older file is loaded." },
      { id: "q19_prior", legacyQ: 19, type: "radio", label: "Was an impact assessment done before deployment?", required: true, options: PRIOR, show: inPilotOrLive, help: "Shown for Pilot and Live. Planning and Procuring are Not applicable. A saved answer stays in the file and is ignored." },
    ],
  },
  {
    id: "risks",
    title: "Section 6: Risks and safeguards",
    fields: [
      { id: "q20_harm", legacyQ: 20, type: "paragraph", label: "What could go wrong?", required: true, help: "Misuse, how it can fail, and who is harmed or bears the cost. Copied word for word." },
      { id: "q20_types", legacyQ: 20, type: "check", label: "Harm types you have considered", options: HARM_TYPES },
      { id: "st20a", legacyQ: 20, type: "statement", statementId: "20a", label: "How far the impact analysis goes", required: true, help: "Recommended practice (RP1)." },
      { id: "st21a", legacyQ: 21, type: "statement", statementId: "21a", label: "Accuracy testing", required: true },
      { id: "st21b", legacyQ: 21, type: "statement", statementId: "21b", label: "Testing whether results differ across groups", required: true },
      { id: "st21c", legacyQ: 21, type: "statement", statementId: "21c", label: "Monitoring after launch", required: true },
      { id: "st21d", legacyQ: 21, type: "statement", statementId: "21d", label: "Logging each use", required: true, help: "Recommended practice (RP6)." },
      { id: "st21e", legacyQ: 21, type: "statement", statementId: "21e", label: "Re-testing", required: true },
      { id: "st22", legacyQ: 22, type: "statement", statementId: "22", repeat: "threat", label: "Protections for each threat", required: true, help: "Recommended practice (RP5). Only threats that fit the Q6 answers are shown. A hidden threat is excluded because of those answers. The fit rules are proposed. Does not apply, when the agency selects it, still needs the matching design fact. Do not describe an attack." },
      { id: "st22f", legacyQ: 22, type: "statement", statementId: "22f", label: "Security testing", required: true },
      { id: "q23_monitor", legacyQ: 23, type: "short", label: "Role that monitors the AI system", role: true },
      { id: "q23_incident", legacyQ: 23, type: "short", label: "Role that handles incidents", role: true },
      { id: "q23_reassess", legacyQ: 23, type: "short", label: "Role that leads reassessment", role: true },
      { id: "st23a", legacyQ: 23, type: "statement", statementId: "23a", label: "Incident and reassessment ownership", required: true },
      { id: "st23b", legacyQ: 23, type: "statement", statementId: "23b", label: "Telling affected people about an incident", required: true, help: "Recommended practice (RP7)." },
      { id: "st23c", legacyQ: 23, type: "statement", statementId: "23c", label: "Staff concerns channel", required: true },
      { id: "st24a", legacyQ: 24, type: "statement", statementId: "24a", label: "Re-check triggers", required: true, help: "Recommended practice (RP8)." },
      { id: "st24b", legacyQ: 24, type: "statement", statementId: "24b", label: "Retirement plan", required: true },
    ],
  },
  {
    id: "attest",
    title: "Section 7: Attestation",
    fields: [
      { id: "q25_confirm", legacyQ: 25, type: "check", label: "Attestation", required: true, options: [{ id: "confirm", label: "I confirm these answers are accurate to the best of my knowledge, and I understand this form is not approval." }], help: "The Word and print export stays off until this is confirmed. That block is a proposed rule. You can still read the on-screen draft." },
    ],
  },
];

export function fieldIsVisible(field: Field, answers: Answers): boolean {
  if (field.show && !field.show(answers)) return false;
  const audience = field.audience ?? FIELD_AUDIENCE[field.id] ?? "high";
  if (!audienceVisible(audience, answers)) return false;
  if (shortenedFieldIds(answers).includes(field.id)) return false;
  return true;
}

export function visibleFields(section: FormSection, answers: Answers): Field[] {
  return section.fields.filter((field) => fieldIsVisible(field, answers));
}

export function activeSections(answers: Answers): FormSection[] {
  return SECTIONS.filter((section) => visibleFields(section, answers).length > 0);
}

export function visibleFieldIds(answers: Answers): string[] {
  return activeSections(answers).flatMap((section) => visibleFields(section, answers).map((field) => field.id));
}

export function sectionHeading(index: number, title: string): string {
  const name = title.replace(/^Section\s+\d+:\s*/, "");
  return `Section ${index + 1}: ${name}`;
}

/** Each visible answer control, including repeated statements and each group relation. Info notes are not counted. */
export function countVisibleQuestions(answers: Answers): number {
  let count = 0;
  const relations = selectedGroups(answers).length;
  for (const section of SECTIONS) {
    for (const field of visibleFields(section, answers)) {
      if (field.type === "info") continue;
      if (field.repeat === "group") count += relations;
      else if (field.repeat === "term") count += CONTRACT_TERMS.length;
      else if (field.repeat === "threat") count += THREATS.filter((threat) => threatApplies(threat.id, answers)).length;
      else count += 1;
      if (field.type === "groups") count += relations;
    }
  }
  return count;
}
