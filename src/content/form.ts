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
import { CONTRACT_TERMS, GROUPS, RELATIONS, THREATS } from "./statements";
import type { Answers } from "../engine/answers";
import { text } from "../engine/answers";
import { selectedGroups, showStatement, threatApplies, vendorInvolved } from "../engine/visibility";

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
const certPicked = (answers: Answers) => {
  const values = answers.q16_assurances;
  const list = Array.isArray(values) ? values : [];
  return list.includes("iso27001") || list.includes("iso42001");
};

export const SECTIONS: FormSection[] = [
  {
    id: "about",
    title: "Section 1: About this request",
    fields: [
      { id: "q1_intake", legacyQ: 1, type: "short", label: "Intake reference number", help: "Copy the reference from your High-risk intake result. Leave blank only if you do not have one yet.", autocomplete: "off", spellcheck: false },
      { id: "q2_agency", legacyQ: 2, type: "short", label: "Agency", required: true, help: "The agency that owns this AI system.", autocomplete: "organization" },
      { id: "q2_unit", legacyQ: 2, type: "short", label: "Unit", required: true, help: "The office or unit inside the agency." },
      { id: "q2_role", legacyQ: 2, type: "short", label: "Your role", required: true, role: true, help: "A role, such as program manager. Do not write a person's name." },
      { id: "q3_is_lead", legacyQ: 3, type: "radio", label: "Are you the Agency Lead who will acknowledge the report?", required: true, options: YES_NO, help: "The Agency Lead signs Section 9 even if someone else fills in this form." },
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
      { id: "q6_capabilities", legacyQ: 6, type: "check", label: "What can the AI system do?", required: true, options: CAPABILITIES, help: "Pick every capability that is true today." },
      { id: "q6_design_facts", legacyQ: 6, type: "check", label: "Which design facts are true today?", options: DESIGN_FACTS, help: "Pick only facts you can point to. They can excuse a specific security threat. They never excuse human review, bias testing, accuracy, accountability or the data level." },
      { id: "q6_method", legacyQ: 6, type: "radio", label: "Method", required: true, options: METHODS },
      { id: "q6_hosting", legacyQ: 6, type: "radio", label: "Where it runs", required: true, options: HOSTING },
      { id: "q6_description", legacyQ: 6, type: "paragraph", label: "Describe what it does, the method and where it runs", required: true, help: "This is copied word for word into the inventory and the appendix. Do not put security settings here." },
      { id: "q7_purpose", legacyQ: 7, type: "paragraph", label: "Purpose and the process it changes", required: true, help: "What problem it solves, how the work is done today, and what changes when staff use it." },
      { id: "q7b_prohibited", legacyQ: 7, type: "check", label: "Does the AI system do any of these?", required: true, options: [...PROHIBITED.map((item) => ({ id: item.id, label: item.label })), { id: "none", label: "None of these" }, { id: "unknown", label: "Unknown" }], help: "This v1 list has the two examples named in the current rules, plus none and unknown. It is not the full Prohibited Uses list. If one applies, the report flags a blocker and still does not approve or reject the system." },
      { id: "q8_areas", legacyQ: 8, type: "check", label: "Which areas could its output affect?", required: true, options: AREAS },
      { id: "q8_target", legacyQ: 8, type: "radio", label: "What does the output pick, rank or act on?", required: true, options: TARGETS, help: "Places or groups can set gate G5. Ranking individual people does not set G5 by itself." },
      { id: "q8_how", legacyQ: 8, type: "short", label: "How could the output affect those areas?", help: "A short line. It is quoted and not scored." },
      { id: "q9_groups", legacyQ: 9, type: "groups", label: "Who is affected?", required: true, options: GROUPS, help: "For each group, say whether they use the system, the output acts on them one by one, or they are affected only in general." },
      { id: "q9_other", legacyQ: 9, type: "short", label: "Other groups", help: "Optional. Name any group the list missed." },
    ],
  },
  {
    id: "decisions",
    title: "Section 3: Decisions and oversight",
    fields: [
      { id: "q10_role", legacyQ: 10, type: "radio", label: "What role does the output play in decisions?", required: true, options: ROLES },
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
        help: "Yes uses the place named in Q6. No asks for the processing place. An older file that already has a processing place keeps that value until this is answered.",
      },
      { id: "q15_where", legacyQ: 15, type: "radio", label: "Where is the data processed?", required: true, options: HOSTING, show: (answers) => text(answers, "q15_same_place") === "no" },
      { id: "st15a", legacyQ: 15, type: "statement", statementId: "15a", label: "Encryption at rest and in transit", required: true, show: (answers) => showStatement("15a", answers), help: "Shown for Level 2 and above, and when the level is Unknown." },
      { id: "st15b", legacyQ: 15, type: "statement", statementId: "15b", label: "Access limited to authorized staff", required: true },
      { id: "st15c", legacyQ: 15, type: "statement", statementId: "15c", label: "Privacy review", required: true, show: (answers) => showStatement("15c", answers), help: "Shown when the privacy track is open: Level 3, Level 4, Unknown, or an overlay." },
      { id: "st15d", legacyQ: 15, type: "statement", statementId: "15d", label: "Retention", required: true, help: "Proposed item. DoIT has not signed off on this mapping." },
      { id: "q16_note", legacyQ: 16, type: "info", label: "Vendor terms do not apply", show: (answers) => text(answers, "q5_builder") === "state_built", help: "Q5 is built by the State with no outside model, so the vendor statements stay hidden and RP2 is not applicable." },
      { id: "st16a", legacyQ: 16, type: "statement", statementId: "16a", label: "Vendor use of State data for training", required: true, show: (answers) => showStatement("16a", answers) },
      { id: "q16_assurances", legacyQ: 16, type: "check", label: "Assurances the vendor has given", show: (answers) => vendorInvolved(answers), options: ASSURANCES, help: "A certificate does not by itself satisfy the contract-term statements." },
      { id: "q16_cert_scope", legacyQ: 16, type: "radio", label: "Does the certificate scope cover this product?", show: certPicked, options: [...YES_NO, { id: "unknown", label: "Unknown" }] },
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

export function visibleFields(section: FormSection, answers: Answers): Field[] {
  return section.fields.filter((field) => !field.show || field.show(answers));
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
