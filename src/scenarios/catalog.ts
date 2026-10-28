import type { ScenarioSpec } from "./build";

const good = "good" as const;
const poor = "poor" as const;

/** Synthetic S01–S24. Gates and deadlines follow the published scenario keys. Extra gates are allowed where the key says "also" or "arguably". */
export const SCENARIOS: ScenarioSpec[] = [
  spec("S01", good, "OutreachMap Grant Outreach Ranker (fictional)", "Maryland Department of Small Business Standards (fictional)", {
    q6_capabilities: ["ranks"], q6_design_facts: ["no_free_text_input", "public_inputs_only", "no_personal_info"],
    q8_areas: ["benefits_services"], q8_target: "places_or_groups", q9_groups: ["businesses"], q9_rel__businesses: "affected_in_general",
    q10_role: "recommends", q12_outside: "yes", q13_level: "L1", q17_status: "live", q18_procured: "before_2026_02_01", q19_start: "2025-09-01", q19_prior: "yes",
  }, ["G1", "G5"], ["G4"], "1 July 2027", false, false, false, 1, 3, "Live, procured before 1 Feb 2026. Staff decide."),
  spec("S02", poor, "CommentFilter Pro (fictional)", "Maryland Office of Public Comment Services (fictional)", {
    q6_capabilities: ["classifies_scores"], q8_areas: ["speech_assembly_religion"], q8_target: "individuals",
    q9_groups: ["general_public"], q9_rel__general_public: "acted_on_individually", q10_role: "decides", q12_outside: "yes",
    q13_level: "L1", q17_status: "live", q18_procured: "before_2026_02_01", q19_start: "2025-03-01", q19_prior: "unknown",
  }, ["G4"], ["G7"], "1 July 2027", false, true, false, 4, 20, "Speech flag is a Section 4 line, not a gate id. Prior assessment unknown."),
  spec("S03", good, "TideWarn Alert Drafter (fictional)", "Maryland Coastal Flood Office (fictional)", {
    q5_builder: "state_built", q6_capabilities: ["generates_text"], q8_areas: ["safety"], q8_target: "neither",
    q9_groups: ["general_public"], q9_rel__general_public: "affected_in_general", q10_role: "recommends", q12_outside: "yes",
    q13_level: "L1", q17_status: "pilot", q18_procured: "state_built", q19_start: "2026-06-01", q19_prior: "yes",
  }, ["G2"], ["G4"], null, false, false, false, 1, 3, "Built by the State, so Q18 is not asked and a saved procurement answer is ignored. No § 3.5-803(e) date is set. Timing follows the pilot status and the start date."),
  spec("S04", poor, "IceSign Auto (fictional)", "Maryland Highway Weather Unit (fictional)", {
    q6_capabilities: ["predicts", "acts_in_other_systems"], q8_areas: ["safety"], q8_target: "neither",
    q9_groups: ["general_public"], q9_rel__general_public: "affected_in_general", q10_role: "decides", q12_outside: "no",
    q13_level: "L1", q17_status: "procuring", q18_procured: "not_yet", q19_prior: "not_applicable",
  }, ["G2", "G4"], [], "31 December 2026", false, false, false, 4, 20, "Procuring and not yet procured. Q12 says no outside people while the public is named."),
  spec("S05", good, "PermitRisk Fire Inspection Prioritizer (fictional)", "Maryland Office of Building Safety (fictional)", {
    q6_capabilities: ["ranks"], q8_areas: ["safety", "money_legal_rights"], q8_target: "places_or_groups",
    q9_groups: ["businesses"], q9_rel__businesses: "affected_in_general", q10_role: "recommends", q12_outside: "yes",
    q13_level: "L1", q17_status: "live", q18_procured: "on_or_after_2026_02_01", q19_start: "2026-03-01", q19_prior: "yes",
  }, ["G1", "G2", "G5"], ["G3", "G4"], "31 December 2026", false, false, false, 1, 3, "Regulatory inspection is not coded, so G3 stays off."),
  spec("S06", poor, "ShelterSpread (fictional)", "Maryland Emergency Shelter Office (fictional)", {
    q6_capabilities: ["ranks"], q8_areas: ["safety", "benefits_services"], q8_target: "places_or_groups",
    q9_groups: ["general_public"], q9_rel__general_public: "affected_in_general", q10_role: "unknown", q12_outside: "yes",
    q13_level: "L1", q17_status: "planning", q18_procured: "not_yet", q19_start: "2025-01-15", q19_prior: "unknown",
  }, ["G2", "G5", "G7"], [], "31 December 2026", false, true, true, 4, 20, "G1 also fires because benefits are ticked. The key calls G1 arguable. Deadline stays on the Q18 rule and the status conflict is flagged."),
  spec("S07", good, "BidLens Evaluation Assistant (fictional)", "Maryland Office of State Purchasing Review (fictional)", {
    q6_capabilities: ["generates_text", "classifies_scores"], q8_areas: ["money_legal_rights"], q8_target: "individuals",
    q9_groups: ["businesses"], q9_rel__businesses: "acted_on_individually", q10_role: "recommends", q12_outside: "yes",
    q13_level: "L2", q14_data_types: ["internal_data"], q17_status: "pilot", q18_procured: "on_or_after_2026_02_01", q19_start: "2026-04-01", q19_prior: "yes",
  }, ["G1"], ["G4"], "31 December 2026", false, false, false, 1, 3, "Level 2 pilot."),
  spec("S08", poor, "ShiftWise Auto-Scheduler (fictional)", "Maryland Department of State Workforce Services (fictional)", {
    q3_is_lead: "no", q3_lead_role: "", q6_capabilities: ["ranks", "acts_in_other_systems"], q8_areas: ["jobs"], q8_target: "individuals",
    q9_groups: ["state_employees"], q9_rel__state_employees: "acted_on_individually", q10_role: "decides", q12_outside: "no",
    q13_level: "L2", q14_data_types: ["internal_data"], q17_status: "live", q18_procured: "before_2026_02_01", q19_start: "2024-11-01", q19_prior: "no",
  }, ["G1", "G4"], [], "1 July 2027", false, true, false, 4, 20, "Agency Lead role left blank. No assessment before deployment."),
  spec("S09", good, "FlowGuard Anomaly Monitor (fictional)", "Maryland Clean Water Operations Agency (fictional)", {
    q5_builder: "state_built", q6_capabilities: ["predicts"], q8_areas: ["safety", "critical_infrastructure"], q8_target: "neither",
    q9_groups: ["general_public"], q9_rel__general_public: "affected_in_general", q10_role: "info_only", q12_outside: "yes",
    q13_level: "L2", q14_data_types: ["internal_data"], q17_status: "live", q18_procured: "state_built", q19_start: "2025-05-01", q19_prior: "yes",
  }, ["G2"], ["G4"], null, false, false, false, 1, 3, "State-built, so Q18 is not asked and no § 3.5-803(e) date is set. Timing follows the live status and the start date. Information only with full review, so G4 stays off."),
  spec("S10", poor, "PlowCare Predictor (fictional)", "Maryland State Fleet Office (fictional)", {
    q6_capabilities: ["predicts"], q8_areas: ["safety"], q8_target: "neither", q9_groups: ["state_employees"], q9_rel__state_employees: "uses_system",
    q10_role: "recommends", q12_outside: "no", q13_level: "L2", q14_data_types: ["internal_data"],
    q17_status: "live", q18_procured: "before_2026_02_01", q19_start: "2024-12-01", q19_prior: "no",
  }, ["G2"], ["G4"], "1 July 2027", false, true, false, 4, 20, "Mechanics decide, so Q10 is recommends. Unknown review does not by itself set G4."),
  spec("S11", good, "PostPlan Staffing Planner (fictional)", "Maryland Department of Correctional Operations (fictional)", {
    q6_capabilities: ["ranks"], q8_areas: ["jobs", "safety"], q8_target: "individuals", q9_groups: ["state_employees"], q9_rel__state_employees: "acted_on_individually",
    q10_role: "recommends", q12_outside: "no", q13_level: "L2", q14_data_types: ["internal_data"],
    q17_status: "planning", q18_procured: "not_yet", q19_prior: "not_applicable",
  }, ["G1", "G2"], ["G3", "G4", "G5"], "31 December 2026", false, false, false, 1, 3, "Policing area is not ticked, so G3 stays off. Target is individuals, so G5 stays off."),
  spec("S12", poor, "ZoneCam Placement Advisor (fictional)", "Maryland Work Zone Safety Office (fictional)", {
    q6_capabilities: ["ranks", "acts_in_other_systems"], q8_areas: ["safety", "automated_enforcement_tickets", "money_legal_rights"], q8_target: "places_or_groups",
    q9_groups: ["general_public"], q9_rel__general_public: "affected_in_general", q10_role: "info_only", q12_outside: "yes",
    st11a: "none", q13_level: "L2", q14_data_types: ["internal_data"], q17_status: "pilot", q18_procured: "on_or_after_2026_02_01", q19_start: "2026-05-01", q19_prior: "yes",
  }, ["G2", "G3", "G4", "G5"], [], "31 December 2026", false, false, false, 4, 20, "G1 also fires because tickets are coded with money or legal rights. G4 comes from the info-only plus acts-in-other-systems cross-check and from no review."),
  spec("S13", good, "EnergyAid Pre-Check (fictional)", "Maryland Office of Home Energy Aid (fictional)", {
    q6_capabilities: ["classifies_scores"], q8_areas: ["benefits_services"], q8_target: "individuals",
    q9_groups: ["low_income"], q9_rel__low_income: "acted_on_individually", q10_role: "recommends", q12_outside: "yes",
    q13_level: "L3", q14_data_types: ["personal_info"], q17_status: "procuring", q18_procured: "not_yet", q19_prior: "not_applicable",
    st16a: "requested",
  }, ["G1"], ["G4"], "31 December 2026", false, false, false, 1, 3, "A planned contract term stays Partial. The cap of 3 still applies when nothing is Gap or Not yet."),
  spec("S14", poor, "WaitlistRank (fictional)", "Maryland Rental Housing Voucher Office (fictional)", {
    q6_capabilities: ["ranks"], q8_areas: ["housing"], q8_target: "individuals", q9_groups: ["low_income", "disabilities"],
    q9_rel__low_income: "acted_on_individually", q9_rel__disabilities: "acted_on_individually", q10_role: "decides", q12_outside: "yes",
    q13_level: "unknown", q14_data_types: ["personal_info"], q17_status: "live", q18_procured: "on_or_after_2026_02_01", q19_start: "2026-02-01", q19_prior: "no",
  }, ["G1", "G4"], [], "31 December 2026", false, true, false, 4, 20, "Data level Unknown with personal information. Suggested level is reported and the level is not invented."),
  spec("S15", good, "TriageAssist Dispatch Helper (fictional)", "Maryland Emergency Medical Dispatch Office (fictional)", {
    q6_capabilities: ["classifies_scores"], q8_areas: ["health", "safety"], q8_target: "individuals",
    q9_groups: ["general_public"], q9_rel__general_public: "acted_on_individually", q10_role: "recommends", q12_outside: "yes",
    q13_level: "L3", q14_data_types: ["health"], q14_overlays: ["HIPAA"], q17_status: "pilot", q18_procured: "on_or_after_2026_02_01", q19_start: "2026-04-15", q19_prior: "yes",
  }, ["G1", "G2"], ["G4"], "31 December 2026", false, false, false, 1, 3, "Health sets G1 even when the area sentence is safety-impacting."),
  spec("S16", poor, "InjuryLens Summarizer (fictional)", "Maryland Workplace Safety Bureau (fictional)", {
    q5_builder: "state_built_outside_model", q6_capabilities: ["generates_text"], q8_areas: ["safety"], q8_target: "places_or_groups",
    q9_groups: ["general_public"], q9_rel__general_public: "affected_in_general", q10_role: "info_only", q12_outside: "no",
    q13_level: "L3", q14_data_types: ["personal_info"], q17_status: "planning", q18_procured: "state_built", q19_prior: "not_applicable",
  }, ["G2", "G5"], ["G4"], null, false, false, false, 3, 20, "Outside model means RP2 is not Not applicable. Q18 Built by the State still has no deadline date."),
  spec("S17", good, "CareVisit Prioritizer (fictional)", "Maryland Office of Senior Home Care (fictional)", {
    q6_capabilities: ["ranks"], q8_areas: ["health", "benefits_services", "safety"], q8_target: "individuals",
    q9_groups: ["older_adults"], q9_rel__older_adults: "acted_on_individually", q10_role: "recommends", q12_outside: "yes",
    q13_level: "L3", q14_data_types: ["health"], q17_status: "planning", q18_procured: "not_yet", q19_prior: "not_applicable",
  }, ["G1", "G2"], ["G4", "G5"], "31 December 2026", false, false, false, 1, 3, "Individuals, not places, so G5 stays off."),
  spec("S18", poor, "SafeStep Chat (fictional)", "Maryland Protective Order Help Center (fictional)", {
    q6_capabilities: ["public_chat", "generates_text"], q8_areas: ["money_legal_rights", "safety"], q8_target: "individuals",
    q9_groups: ["abuse_risk", "general_public"], q9_rel__abuse_risk: "uses_system", q9_rel__general_public: "uses_system",
    q10_role: "unknown", q12_outside: "yes", q13_level: "L2", q14_data_types: ["abuse_details"],
    q17_status: "pilot", q18_procured: "on_or_after_2026_02_01", q19_start: "2026-06-01", q19_prior: "unknown",
  }, ["G1", "G2", "G7"], [], "31 December 2026", false, true, false, 4, 20, "Level 2 with abuse details suggests a higher level. G4 is acceptable in the key and is not required here."),
  spec("S19", good, "RefundCheck Selector (fictional)", "Maryland Revenue Review Office (fictional)", {
    q6_capabilities: ["matches_records", "classifies_scores"], q8_areas: ["money_legal_rights"], q8_target: "individuals",
    q9_groups: ["general_public"], q9_rel__general_public: "acted_on_individually", q10_role: "recommends", q12_outside: "yes",
    q13_level: "L4", q14_data_types: ["tax_fti"], q14_overlays: ["IRS_PUB_1075"], q17_status: "live", q18_procured: "before_2026_02_01", q19_start: "2025-08-01", q19_prior: "yes",
  }, ["G1", "G6"], ["G4"], "1 July 2027", false, false, false, 1, 3, "Record matching plus a rights area sets proposed gate G6."),
  spec("S20", poor, "CheckIn Risk Scorer (fictional)", "Maryland Office of Community Supervision (fictional)", {
    q6_capabilities: ["biometric_id", "classifies_scores", "acts_in_other_systems"], q7b_prohibited: ["covert_or_realtime_biometric_id_no_consent"],
    q8_areas: ["policing_corrections_supervision", "identifying_people", "money_legal_rights"], q8_target: "individuals",
    q9_groups: ["general_public"], q9_rel__general_public: "acted_on_individually", q10_role: "decides", q12_outside: "yes",
    q13_level: "L4", q14_data_types: ["criminal_justice"], q14_overlays: ["CJIS"], q17_status: "live", q18_procured: "before_2026_02_01", q19_start: "2025-02-01", q19_prior: "unknown",
  }, ["G1", "G3", "G4"], [], "1 July 2027", true, true, false, 4, 20, "Prohibited-use checklist is ticked. The report still has no go or no-go line."),
  spec("S21", good, "AlertDraft Missing Person Notice Assistant (fictional)", "Maryland Missing Persons Coordination Unit (fictional)", {
    q5_builder: "state_built", q6_capabilities: ["generates_text"], q8_areas: ["safety", "identifying_people"], q8_target: "individuals",
    q9_groups: ["general_public"], q9_rel__general_public: "affected_in_general", q10_role: "recommends", q12_outside: "yes",
    q13_level: "L4", q14_data_types: ["criminal_justice"], q14_overlays: ["CJIS"], q17_status: "pilot", q18_procured: "state_built", q19_start: "2026-07-01", q19_prior: "yes",
  }, ["G2", "G3"], ["G4"], null, false, false, false, 1, 3, "State-built, so Q18 is not asked and no § 3.5-803(e) date is set. Timing follows the pilot status and the start date. Identifying people sets G3 and is also coded as rights, so the area sentence can read as both."),
  spec("S22", poor, "AutoDispatch Locator (fictional)", "Maryland 911 Coordination Office (fictional)", {
    q6_capabilities: ["acts_in_other_systems", "classifies_scores"], q8_areas: ["safety", "policing_corrections_supervision"], q8_target: "individuals",
    q9_groups: ["general_public"], q9_rel__general_public: "acted_on_individually", q10_role: "decides", q12_outside: "no",
    q13_level: "L4", q14_data_types: ["criminal_justice", "precise_location"], q14_overlays: ["CJIS"], q17_status: "procuring", q18_procured: "not_yet", q19_prior: "not_applicable",
  }, ["G2", "G3", "G4"], [], "31 December 2026", false, false, false, 4, 20, "Not yet procured. Q12 Not applicable conflicts with the public being named."),
  spec("S23", good, "IntakeScreen Summary Assistant (fictional)", "Maryland Youth Detention Intake Office (fictional)", {
    q5_builder: "state_built", q6_capabilities: ["generates_text"], q8_areas: ["money_legal_rights", "safety", "policing_corrections_supervision"], q8_target: "individuals",
    q9_groups: ["children"], q9_rel__children: "acted_on_individually", q10_role: "recommends", q12_outside: "no",
    q13_level: "L4", q14_data_types: ["criminal_justice", "student_records"], q14_overlays: ["CJIS", "FERPA"],
    q17_status: "planning", q18_procured: "state_built", q19_prior: "not_applicable",
  }, ["G1", "G2", "G3"], ["G4"], null, false, false, false, 1, 3, "Built by the State, including youth records. Q18 and Q19 are not asked. No § 3.5-803(e) date is set. Timing follows Planning, and use has not started."),
  spec("S24", poor, "VisitVerify Flagger (fictional)", "Maryland Home Health Program Integrity Office (fictional)", {
    q6_capabilities: ["matches_records", "classifies_scores"], q8_areas: ["health", "money_legal_rights", "safety"], q8_target: "individuals",
    q9_groups: ["older_adults"], q9_rel__older_adults: "acted_on_individually", q10_role: "recommends", st11a: "sample", q12_outside: "yes",
    q13_level: "L4", q14_data_types: ["health", "precise_location"], q14_overlays: ["HIPAA", "SSA"],
    q17_status: "live", q18_procured: "before_2026_02_01", q19_start: "2025-04-01", q19_prior: "unknown",
  }, ["G1", "G2", "G6"], [], "1 July 2027", false, true, false, 4, 20, "Sample review sets G4, which the key marks as possible rather than required."),
];

function spec(
  id: string,
  profile: "good" | "poor",
  system: string,
  agency: string,
  answers: ScenarioSpec["answers"],
  requiredGates: string[],
  forbiddenGates: string[],
  deadline: string | null,
  prohibited: boolean,
  priorFact: boolean,
  conflict: boolean,
  minMitigations: number,
  maxMitigations: number,
  note: string,
): ScenarioSpec {
  return { id, profile, system, agency, answers, requiredGates, forbiddenGates, deadline, prohibited, priorFact, conflict, minMitigations, maxMitigations, note };
}
