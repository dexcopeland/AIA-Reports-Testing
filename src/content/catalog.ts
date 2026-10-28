export const BUILDERS = [
  { id: "vendor_product", label: "A vendor product" },
  { id: "vendor_product_agency_changed", label: "A vendor product that the agency changed or extended" },
  { id: "state_built_outside_model", label: "Built by the State, using an outside hosted model or API" },
  { id: "state_built", label: "Built by the State, with no outside model or vendor" },
  { id: "unknown", label: "Unknown" },
];

export const CAPABILITIES = [
  { id: "generates_text", label: "Writes or drafts text" },
  { id: "classifies_scores", label: "Classifies, scores or flags" },
  { id: "ranks", label: "Ranks or prioritizes" },
  { id: "predicts", label: "Predicts an event or value" },
  { id: "matches_records", label: "Matches records across data sets" },
  { id: "biometric_id", label: "Identifies people from faces, voices or other body features" },
  { id: "public_chat", label: "Chats with members of the public" },
  { id: "retrieves_documents", label: "Pulls documents into its answers" },
  { id: "acts_in_other_systems", label: "Sends its output to other systems that act on it" },
  { id: "unknown", label: "Unknown" },
];

export const DESIGN_FACTS = [
  { id: "no_free_text_input", label: "No one can type free text into it" },
  { id: "outputs_not_passed", label: "Its output is not passed to any other system" },
  { id: "no_personal_info", label: "It uses no personal information" },
  { id: "public_inputs_only", label: "All inputs are public files or public data" },
  { id: "none_of_these", label: "None of these" },
];

export const METHODS = [
  { id: "statistical", label: "A statistical or ranking model" },
  { id: "llm", label: "A large language model" },
  { id: "rules_plus_model", label: "Rules plus a model" },
  { id: "other", label: "Another method" },
  { id: "unknown", label: "Unknown" },
];

export const HOSTING = [
  { id: "vendor_cloud", label: "Vendor cloud" },
  { id: "state_data_center", label: "State data center" },
  { id: "agency_network", label: "Agency network" },
  { id: "staff_devices", label: "Staff devices" },
  { id: "unknown", label: "Unknown" },
];

export const ROLES = [
  { id: "decides", label: "Decides or acts without a person approving each one" },
  { id: "recommends", label: "Recommends or scores; staff decide" },
  { id: "info_only", label: "Gives information to staff only" },
  { id: "unknown", label: "Unknown" },
];

export const LEVELS = [
  { id: "L1", label: "Level 1 Public" },
  { id: "L2", label: "Level 2 Protected / internal use" },
  { id: "L3", label: "Level 3 Confidential" },
  { id: "L4", label: "Level 4 Restricted" },
  { id: "unknown", label: "Unknown" },
];

export const DEPLOYMENT = [
  { id: "planning", label: "Planning" },
  { id: "procuring", label: "Procuring" },
  { id: "pilot", label: "Pilot" },
  { id: "live", label: "Live" },
];

export const PROCUREMENT = [
  { id: "before_2026_02_01", label: "Before 1 Feb 2026" },
  { id: "on_or_after_2026_02_01", label: "On or after 1 Feb 2026" },
  { id: "not_yet", label: "Not yet procured" },
  { id: "state_built", label: "Built by the State" },
  { id: "unknown", label: "Unknown" },
];

export const PRIOR = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "unknown", label: "Unknown" },
  { id: "not_applicable", label: "Not applicable" },
];

export const TARGETS = [
  { id: "individuals", label: "Individual people, applicants, filers or cases" },
  { id: "places_or_groups", label: "Places, areas or groups, such as counties, neighborhoods, workplaces or work zones" },
  { id: "both", label: "Both individuals and places or groups" },
  { id: "neither", label: "Neither. It gives general information" },
  { id: "unknown", label: "Unknown" },
];

export const ASSURANCES = [
  { id: "soc2", label: "SOC 2" },
  { id: "fedramp", label: "FedRAMP" },
  { id: "stateramp", label: "StateRAMP" },
  { id: "iso27001", label: "ISO/IEC 27001" },
  { id: "iso42001", label: "ISO/IEC 42001" },
  { id: "none", label: "None" },
  { id: "unknown", label: "Unknown" },
];

export const YES_NO = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

export const HARM_TYPES = [
  { id: "wrong_decision", label: "A wrong decision about a person" },
  { id: "missed_service", label: "Someone misses a service or benefit" },
  { id: "safety_harm", label: "Physical harm or a missed warning" },
  { id: "privacy_harm", label: "Private information is exposed" },
  { id: "bias_harm", label: "A group is treated worse than others" },
  { id: "rights_harm", label: "A right or liberty is affected" },
  { id: "unknown", label: "Unknown" },
];

export function labelOf(options: { id: string; label: string }[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? id;
}
