import type { MitigationDef } from "./types";

export const EVIDENCE_CHECK = {
  proposed: true,
  minWords: 5,
  rejectExact: ["yes", "done", "n/a", "na", "tbd", "see above", "in place", "complete", "we do this", "ok", "none"],
};

export const TOKEN_EVIDENCE_NOTE =
  "Proposed rule: blank or token evidence on a strongest statement (under 5 words, or a token such as yes, done, or see above) drops that item to Partial or Partly in place and raises a follow-up. This is not a fact check.";

/** Criterion items whose unknown answer is Partial, not Gap (v18 C5). */
export const C5_PARTIAL_UNKNOWN = new Set(["12d", "12e"]);

export const RIGHTS_AREAS = [
  "benefits_services",
  "housing",
  "money_legal_rights",
  "jobs",
  "policing_corrections_supervision",
  "investigations",
  "identifying_people",
  "automated_enforcement_tickets",
  "speech_assembly_religion",
  "privacy",
];

export const SAFETY_AREAS = ["health", "safety", "critical_infrastructure"];

export const G1_AREAS = ["benefits_services", "health", "housing", "money_legal_rights", "jobs"];

export const G3_AREAS = [
  "policing_corrections_supervision",
  "investigations",
  "identifying_people",
  "automated_enforcement_tickets",
];

export const G6_AREAS = [
  "benefits_services",
  "health",
  "housing",
  "money_legal_rights",
  "jobs",
  "policing_corrections_supervision",
  "investigations",
];

export const AREAS: { id: string; label: string }[] = [
  { id: "benefits_services", label: "Benefits or public services" },
  { id: "health", label: "Health or access to health care" },
  { id: "housing", label: "Housing" },
  { id: "money_legal_rights", label: "Money or legal rights" },
  { id: "jobs", label: "Jobs or employment" },
  { id: "safety", label: "People's physical safety" },
  { id: "critical_infrastructure", label: "Critical infrastructure" },
  { id: "policing_corrections_supervision", label: "Police, corrections or community supervision" },
  { id: "investigations", label: "Investigations" },
  { id: "identifying_people", label: "Identifying people" },
  { id: "automated_enforcement_tickets", label: "Automated enforcement that leads to tickets or citations" },
  { id: "regulatory_inspection", label: "Inspections by a non-police agency, such as fire, health or building" },
  { id: "speech_assembly_religion", label: "Speech, assembly or religion" },
  { id: "privacy", label: "Privacy" },
  { id: "unknown", label: "Unknown" },
];

export const DATA_TYPES: { id: string; label: string; suggests: string }[] = [
  { id: "public_data", label: "Public data only", suggests: "L1" },
  { id: "internal_data", label: "Internal agency data that is not personal", suggests: "L2" },
  { id: "personal_info", label: "Personal information", suggests: "L3" },
  { id: "health", label: "Health information", suggests: "L3" },
  { id: "precise_location", label: "Precise location", suggests: "L3" },
  { id: "student_records", label: "Student records", suggests: "L3" },
  { id: "payment", label: "Payment data", suggests: "L3" },
  { id: "abuse_details", label: "Details of abuse, stalking or a protective order", suggests: "L3" },
  { id: "criminal_justice", label: "Criminal justice information", suggests: "L4" },
  { id: "tax_fti", label: "Federal tax information", suggests: "L4" },
  { id: "unknown", label: "Unknown", suggests: "L3" },
];

export const OVERLAYS: { id: string; label: string }[] = [
  { id: "HIPAA", label: "HIPAA" },
  { id: "FERPA", label: "FERPA" },
  { id: "CJIS", label: "CJIS" },
  { id: "IRS_PUB_1075", label: "IRS Publication 1075" },
  { id: "SSA", label: "SSA" },
  { id: "other", label: "Another overlay" },
  { id: "none", label: "None" },
  { id: "unknown", label: "Unknown" },
];

export const LEVEL_LABEL: Record<string, string> = {
  L1: "Level 1",
  L2: "Level 2",
  L3: "Level 3",
  L4: "Level 4",
  unknown: "Unknown",
};

export const LEVEL_SAFEGUARD: Record<string, string> = {
  L1: "Level 1 Public: no protection from unauthorized disclosure is needed for public release. Integrity and availability still need protection as the system requires [P3].",
  L2: "Level 2 Protected/Internal Use Only: access limited to authorized staff, and data encrypted at rest and in transit [P3] [P4] [P5].",
  L3: "Level 3 Confidential: authorized users only, encryption at rest and in transit, use only for the purpose collected, and a PTA (PIA if the State Chief Privacy Officer directs) [P3] [P4].",
  L4: "Level 4 Restricted: authorized users who meet the regulatory requirements only, encryption at rest and in transit, and the stricter overlay controls for the full lifecycle [P3] [P4].",
};

export const PROHIBITED: { id: string; label: string }[] = [
  {
    id: "covert_or_realtime_biometric_id_no_consent",
    label: "Identifies people from biometrics covertly or in real time without their consent",
  },
  { id: "social_scoring", label: "Scores people's social behavior or personal traits" },
];

export const MITIGATIONS: MitigationDef[] = [
  {
    id: "M-PROHIBITED",
    title: "Resolve the prohibited use before any use",
    action: "Stop or remove the prohibited function before any use, and record how it was removed.",
    owner: "Agency Lead",
    sources: ["P1"],
    remaining: "The function could return in a later version unless it is re-checked at each change.",
    rpOnly: false,
    timing: "TN",
    capBand: 0,
  },
  {
    id: "M-REVIEW",
    title: "Human review of each output before it takes effect",
    action:
      "Have a named role review each output before it takes effect, with power to change or stop it, and record every override.",
    owner: "Business owner",
    sources: ["D1", "P1"],
    remaining: "Reviewers can still follow the output too readily. Override records show whether the review is real.",
    rpOnly: false,
    timing: "TN",
    capBand: 2,
  },
  {
    id: "M-TRAIN",
    title: "Written instructions and training",
    action:
      "Give staff written instructions and training on purpose, limits, prohibited uses and when to check output, and send new uses back to intake.",
    owner: "Business owner",
    sources: ["D1", "R1"],
    remaining: "Staff can still use the AI system outside the assessed purpose if the instructions are not followed.",
    rpOnly: true,
    timing: "TW",
    capBand: 2,
  },
  {
    id: "M-NOTICE",
    title: "AI notice and a contact path to a person",
    action: "Tell people, where they meet the decision or contact, that AI is involved, and give a path to a person who can review the output.",
    owner: "Business owner",
    sources: ["D1", "P1"],
    remaining: "People can still miss the notice if it is not at the point of the decision.",
    rpOnly: false,
    timing: "TN",
    capBand: 2,
  },
  {
    id: "M-CONTEST",
    title: "A way to correct data and challenge a result",
    action: "Let people correct their data and challenge a result, and have a person review the challenge and change the result when it is wrong.",
    owner: "Business owner",
    sources: ["D1", "P1"],
    remaining: "A challenge path that is slow or hard to find leaves the bad result in place.",
    rpOnly: false,
    timing: "TN",
    capBand: 2,
  },
  {
    id: "M-LANG",
    title: "Language access",
    action: "Offer notices and contact in the languages people use, and have speakers or interpreters check them.",
    owner: "Business owner",
    sources: ["D1", "P2"],
    remaining: "People can still be left out if a language they use is not offered.",
    rpOnly: false,
    timing: "TN",
    capBand: 1,
  },
  {
    id: "M-ACCESS",
    title: "An access path that fits each named group",
    action: "Put in place a path each named group can use, such as phone, paper, in person, an accessible format or an interpreter.",
    owner: "Business owner",
    sources: ["D1", "P1"],
    remaining: "A path that exists only on paper does not help the group if they cannot reach it.",
    rpOnly: false,
    timing: "TN",
    capBand: 1,
  },
  {
    id: "M-ABUSE",
    title: "Quick exit, no saved history and safe notices",
    action:
      "Add a quick exit, keep chat or search history off the device and account, and make sure notices cannot reveal use to the person causing harm.",
    owner: "Agency privacy lead",
    sources: ["D1", "P1"],
    remaining: "A shared device can still reveal use if one of the three controls is missing.",
    rpOnly: false,
    timing: "TN",
    capBand: 0,
  },
  {
    id: "M-DATAQ",
    title: "Record sources, check quality and limit retrieval",
    action:
      "Record data sources, check quality on a set schedule, limit who can change the data, and let users retrieve only what they can already see.",
    owner: "Business owner",
    sources: ["D1", "R1"],
    remaining: "Bad or changed source data can still flow into outputs between checks.",
    rpOnly: true,
    timing: "TW",
    capBand: 2,
  },
  {
    id: "M-ENCRYPT",
    title: "Encryption and access limits",
    action: "Encrypt the data at rest and in transit everywhere it is processed or stored, and limit access to authorized staff.",
    owner: "Agency information security",
    sources: ["P3", "P4", "P5"],
    remaining: "Keys and accounts still need care after encryption is in place.",
    rpOnly: false,
    timing: "TN",
    capBand: 2,
  },
  {
    id: "M-PRIVACY",
    title: "Privacy review and retention",
    action: "Finish the PTA, and the PIA if the State Chief Privacy Officer directs one, and delete data on the records schedule.",
    owner: "Agency privacy lead",
    sources: ["P4", "P3"],
    remaining: "A finished PTA does not by itself fix a later change in the data the AI system uses.",
    rpOnly: false,
    timing: "TN",
    capBand: 2,
  },
  {
    id: "M-NOTRAIN",
    title: "Contract ban on training on State data",
    action: "Put a signed contract term that bans the vendor from training on State data.",
    owner: "Procurement officer",
    sources: ["P1", "D1"],
    remaining: "A ban that is not in the signed contract can be dropped before award.",
    rpOnly: false,
    timing: "TC",
    capBand: 2,
  },
  {
    id: "M-CONTRACT",
    title: "Contract duties and notice terms",
    action:
      "Put signed terms that split responsibilities and require notice of model changes and AI security incidents. A certificate alone does not meet this.",
    owner: "Procurement officer",
    sources: ["D1", "R1"],
    remaining: "A certificate whose scope does not cover this product does not show these terms.",
    rpOnly: true,
    timing: "TC",
    capBand: 2,
  },
  {
    id: "M-IMPACT",
    title: "Written analysis of misuse, failure and harm",
    action: "Write down foreseeable misuse, how the AI system can fail or get results wrong, and who is harmed or bears the cost.",
    owner: "Business owner",
    sources: ["D1", "R1"],
    remaining: "A written list can still miss a harm that shows up only in use.",
    rpOnly: true,
    timing: "TW",
    capBand: 2,
  },
  {
    id: "M-ACCURACY",
    title: "Accuracy testing and drift monitoring",
    action: "Test accuracy on the agency's own data with set criteria, and track errors after launch against an agreed threshold.",
    owner: "Business owner",
    sources: ["D1", "P1"],
    remaining: "Results can still drift after a model update if the next test is late.",
    rpOnly: false,
    timing: "TW",
    capBand: 2,
  },
  {
    id: "M-BIAS",
    title: "Bias testing on a Maryland-like population",
    action: "Test whether results differ across groups on a population like Maryland's, and repeat outcome checks on a set schedule.",
    owner: "Business owner",
    sources: ["D1", "P1"],
    remaining: "A single test does not show whether differences grow after launch.",
    rpOnly: false,
    timing: "TW",
    capBand: 2,
  },
  {
    id: "M-LOG",
    title: "Logging and scheduled re-testing",
    action:
      "Log each use with input, output, time, user and model version, protect the logs at the data level, and re-run a fixed test set on a schedule and after each model update.",
    owner: "Agency information security",
    sources: ["D1", "R2"],
    remaining: "Logs that omit the model version make it hard to trace a bad output.",
    rpOnly: true,
    timing: "TW",
    capBand: 2,
  },
  {
    id: "M-SEC",
    title: "Threat model and security testing",
    action: "Write a threat model for the open threats and test it, recording the results. Do not put attack detail in this report.",
    owner: "Agency information security",
    sources: ["D1", "R2"],
    remaining: "A test covers the threats that were in scope. A new connection can open another.",
    rpOnly: true,
    timing: "TW",
    capBand: 2,
  },
  {
    id: "M-OWNER",
    title: "Named incident and reassessment owner",
    action: "Name roles for monitoring, incidents and reassessment, write the process, and reassess at least yearly.",
    owner: "Agency Lead",
    sources: ["S4", "P2", "D1"],
    remaining: "A named role still needs time and a written process to act when an incident happens.",
    rpOnly: false,
    timing: "TW",
    capBand: 2,
  },
  {
    id: "M-INCIDENT",
    title: "Incident notice and a staff concerns channel",
    action:
      "Name a role to tell affected people and users about an incident by a set method within a set time, and tell staff about a concerns channel outside the team.",
    owner: "Agency Lead",
    sources: ["D1", "R1"],
    remaining: "Notice that is slow or easy to miss leaves people exposed after an incident.",
    rpOnly: true,
    timing: "TW",
    capBand: 2,
  },
  {
    id: "M-CHANGE",
    title: "Re-check triggers and a retirement plan",
    action:
      "Write a procedure that re-checks the assessment for a new model version, new data, new tools or permissions, or a new use, and a retirement plan for models, data, document stores and logs.",
    owner: "Business owner",
    sources: ["D1", "R2"],
    remaining: "A trigger that is not written into procedure is easy to skip when a vendor ships an update.",
    rpOnly: true,
    timing: "TW",
    capBand: 2,
  },
  {
    id: "M-ONGOING",
    title: "Keep monitoring, audits and yearly reassessment",
    action:
      "Keep monitoring, outcome checks across groups, re-tests after model updates, and reassessment at least yearly.",
    owner: "Agency Lead",
    sources: ["S4", "P2", "D1"],
    remaining: "Checks that stop after launch will miss drift and new uses.",
    rpOnly: false,
    timing: "TO",
    capBand: 9,
  },
];

export const MITIGATION_BY_ID: Record<string, MitigationDef> = Object.fromEntries(
  MITIGATIONS.map((item) => [item.id, item]),
);

export const CRITERIA_META: { id: string; name: string; kind: "impact" | "status" }[] = [
  { id: "C1", name: "Rights", kind: "impact" },
  { id: "C2", name: "Safety", kind: "impact" },
  { id: "C3", name: "Benefits and services", kind: "impact" },
  { id: "C4", name: "Decision and automation level", kind: "status" },
  { id: "C5", name: "Affected groups", kind: "status" },
  { id: "C6", name: "Bias testing", kind: "status" },
  { id: "C7", name: "Notice", kind: "status" },
  { id: "C8", name: "Contest and redress", kind: "status" },
  { id: "C9", name: "Human oversight", kind: "status" },
  { id: "C10", name: "Data and privacy", kind: "status" },
  { id: "C11", name: "Accuracy", kind: "status" },
  { id: "C12", name: "Accountability", kind: "status" },
];

export const RP_META: { id: string; name: string; aligned: string }[] = [
  { id: "RP1", name: "Impact scope", aligned: "ISO/IEC 42001 cl. 6.1.4; A.5.2–A.5.4 [R1]." },
  {
    id: "RP2",
    name: "Supplier responsibilities",
    aligned: "ISO/IEC 42001 A.10.2, A.10.3; ISO/IEC 27090 cl. 5.5.5, B.3.3 [R1] [R2].",
  },
  {
    id: "RP3",
    name: "Data quality and provenance",
    aligned: "ISO/IEC 42001 A.7.2–A.7.6; ISO/IEC 27090 cl. 6.9.4, 7.6 [R1] [R2].",
  },
  { id: "RP4", name: "Oversight people and instructions", aligned: "ISO/IEC 42001 A.8.2, A.9.3, A.9.4 [R1]." },
  { id: "RP5", name: "AI-specific security threats", aligned: "ISO/IEC 27090 cl. 5.6, 5.7, 6.2–6.10 [R2]." },
  { id: "RP6", name: "Logging and scheduled re-testing", aligned: "ISO/IEC 27090 cl. 6.11.3.5, 7.2, 7.4, 7.5 [R2]." },
  { id: "RP7", name: "Incident notice and concerns channel", aligned: "ISO/IEC 42001 A.3.3, A.8.3, A.8.4 [R1]." },
  {
    id: "RP8",
    name: "Change and retirement",
    aligned: "ISO/IEC 27090 cl. 5.5.2, 6.11.3.3, 6.11.4, 7.6 [R2].",
  },
];

export const SOURCES: { id: string; name: string; url: string }[] = [
  {
    id: "S1",
    name: "SF&P § 3.5-801 (definitions, High-risk, rights- and safety-impacting)",
    url: "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gsf&section=3.5-801&enactments=false",
  },
  {
    id: "S2",
    name: "SF&P § 3.5-803 (inventory fields and impact assessment deadlines)",
    url: "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gsf&section=3.5-803&enactments=false",
  },
  {
    id: "S3",
    name: "SF&P § 3.5-804 (AI policies and procedures)",
    url: "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gsf&section=3.5-804&enactments=false",
  },
  {
    id: "S4",
    name: "SF&P § 3.5-805 (compliance and regular impact assessments)",
    url: "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gsf&section=3.5-805&enactments=false",
  },
  {
    id: "P1",
    name: "Responsible AI Policy",
    url: "https://doit.maryland.gov/policies/ai/Pages/maryland-responsible-ai-policy.aspx",
  },
  {
    id: "P2",
    name: "Responsible AI Policy Implementation Guidance",
    url: "https://doit.maryland.gov/policies/ai/Pages/maryland-responsible-ai-policy-implementation-guidance.aspx",
  },
  {
    id: "P3",
    name: "Data Classification Policy (v1.2, revised 3 Aug 2026), Levels 1–4 and handling rules",
    url: "https://doit.maryland.gov/policies/ci/Pages/data-classification-policy.aspx",
  },
  {
    id: "P4",
    name: "MD-POL-205 Data Protection and Privacy Policy (encryption at rest and in transit for Level 2+; PTA/PIA)",
    url: "https://doit.maryland.gov/policies/ci/Documents/MD-POL-205-01-Data-Protection-and-Privacy-Policy.pdf",
  },
  {
    id: "P5",
    name: "MD-STD-318-SC System and Communication Protection Standard (encryption detail)",
    url: "https://doit.maryland.gov/policies/ci/Documents/MD-STD-318-SC-01-System-and-Communication-Protection-Standard.pdf",
  },
  {
    id: "P6",
    name: "EO 01.01.2024.02 Catalyzing the Responsible and Productive Use of AI",
    url: "https://doit.maryland.gov/policies/ai/Documents/EO%2001.01.2024.02%20Catalyzing%20the%20Responsible%20and%20Productive%20Use%20of%20Artificial%20Intelligence%20in%20Maryland%20State%20Government_Accessible.pdf",
  },
  {
    id: "R1",
    name: "ISO/IEC 42001:2023 Artificial intelligence – Management system (recommended practice; clause numbers only)",
    url: "https://www.iso.org/standard/81230.html",
  },
  {
    id: "R2",
    name: "ISO/IEC 27090:2026 Cybersecurity – Artificial intelligence – Addressing security threats and compromises to AI systems (recommended practice; clause numbers only)",
    url: "https://www.iso.org/standard/56581.html",
  },
  {
    id: "D1",
    name: "DoIT AI Governance methodology: risk gates G1–G7, criteria C1–C12 and recommended practice checks RP1–RP8 (no URL)",
    url: "",
  },
];

export const FIXED = {
  purpose: [
    "Maryland law (SF&P § 3.5-803) requires an algorithmic impact assessment for each High-risk AI system a State agency uses. The Responsible AI Policy expects safeguards that protect residents' rights, safety and privacy. This report identifies risks, gaps and recommended mitigations. It is advisory and is not an approval or authorization to buy, use or deploy the AI system. The Agency Lead reviews each recommended mitigation, records a plan and target date for each one, and signs the acknowledgment in Section 9.",
    "This report also checks 8 recommended practices drawn from 2 international standards, ISO/IEC 42001 (AI management systems) and ISO/IEC 27090 (AI security). DoIT has not adopted these standards as policy. Findings from them are recommendations, not compliance findings.",
    "This report is based only on the agency's answers as submitted. DoIT did not check whether they are accurate. The agency is responsible for making sure its answers are accurate and complete, as the respondent confirmed in Q25.",
  ],
  followupOpener:
    "This section is your action list. For each risk, gap and mitigation in this report, it lists what to gather, who will likely lead the work, the questions to work through and what done looks like.",
  accuracy:
    "I confirm that the agency's answers are accurate and complete, and that the agency will update this assessment if anything changes.",
  acknowledge:
    "I acknowledge the risks and recommended mitigations in this report and accept responsibility for the plans above before this AI system moves forward.",
  leadNote: "If the Agency Lead did not submit the form, the Agency Lead still signs.",
  noIntake: "No intake reference. DoIT AI Governance must confirm the High-risk result.",
  noDate: "The § 3.5-803(e) deadline depends on the procurement date; DoIT AI Governance will confirm it.",
  appendixNote:
    "These are the agency's answers to the 25 form questions as submitted (Response ID {id}, submitted {when}). They are copied word for word and have not been edited or checked by DoIT. The agency is responsible for the accuracy of its answers. Questions marked recommended practice also reflect ISO/IEC 42001 or ISO/IEC 27090.",
  draftBanner: "Draft for DoIT AI Governance review.",
  notDeployed: "Not yet deployed – this assessment precedes deployment.",
};

export const BANNED = [
  "prior to",
  "utilize",
  "utilization",
  "utilizing",
  "statutory high-risk",
  "compliance plan",
  "compliance gaps",
  "required mitigations",
  "complies",
  "is secure",
  "quietly",
  "quiet",
];

export const APPROVAL_BANNED = [
  "Approved with conditions",
  "Not approved",
  "may proceed",
  "go / no-go",
  "go/no-go",
];

export const PROPOSED_RULES: { id: string; text: string }[] = [
  {
    id: "statement-wording",
    text: "All 32 safeguard statement sets, including their status and mitigation mappings, are proposals for review.",
  },
  {
    id: "evidence-check",
    text: TOKEN_EVIDENCE_NOTE,
  },
  {
    id: "evidence-required-split",
    text: "Evidence is required for a Met criterion item and optional for an In place recommended-practice item. A thin optional line still drops the status.",
  },
  {
    id: "retention",
    text: "Retention (item 15d) is a proposed C10 item. Unknown raises a follow-up and does not by itself add a mitigation.",
  },
  {
    id: "q18-unknown",
    text: "Q18 includes Unknown. Blank or Unknown uses the no-date sentence and a Q18 follow-up.",
  },
  {
    id: "g4-decides",
    text: "G4 applies when Q10 is decides, unless the agency picked a statement that every output is reviewed before it takes effect. Sample review, review after effect, and no review also set G4.",
  },
  {
    id: "g4-cross-check",
    text: "Proposed cross-check: Q6 acts in other systems together with Q10 info only sets G4 when every output is not reviewed first (scenario 12 pattern).",
  },
  {
    id: "g6",
    text: "G6 is proposed as record matching plus an area where the match can lead to an adverse action.",
  },
  {
    id: "biometric-combo",
    text: "Proposed combination flag: biometric identification plus the identifying-people area raises the prohibited-use blocker even if the checklist was left as none. The published Prohibited Uses list is not fully encoded in v1.",
  },
  {
    id: "export-gate",
    text: "Proposed: the Word and print export stays blocked until Q25 is confirmed. The on-screen draft still renders.",
  },
  {
    id: "cap-priority",
    text: "When no C4–C12 item is Gap and no RP item is Not yet, mitigations are capped at 3 including Ongoing. Priority is a prohibited use or abuse-risk control, then a C5 path for a group that uses the system or is acted on as individuals, then other partial items by earliest timing.",
  },
  {
    id: "status-conflict",
    text: "A start date while Q17 is Planning or Procuring is a proposed cross-check. Timing then uses Before use.",
  },
  {
    id: "outside-people",
    text: "Q12 answered as no outside people, while Q9 names a group other than State employees, is a proposed cross-check. C7 and C8 become Gap.",
  },
  {
    id: "level-cross-check",
    text: "Q14 data types suggest a minimum level. If that level is above Q13, Section 4 says so. The level itself is not changed.",
  },
  {
    id: "threat-fit",
    text: "Proposed: Q22 shows only the threats that fit the Q6 answers. Prompt injection is limited to generative, chat, or document-retrieval systems. Poisoning is limited to systems that may be trained or fine-tuned on agency data. Unclear threats stay visible, including every threat when capabilities are Unknown or empty. A hidden threat is excluded because of the Q6 answers.",
  },
];
