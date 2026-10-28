export const SCHEMA_VERSION = "1.0.0";
export const FORM_VERSION = "v2-structured-1.0.0";
export const RULES_VERSION = "1.1.0";

export type CriterionStatus = "Met" | "Partial" | "Gap";
export type RpStatus = "In place" | "Partly in place" | "Not yet" | "Not applicable";
export type ItemStatus = CriterionStatus | RpStatus;
export type Track = "C" | "RP";
export type TimingProfile = "TN" | "TW" | "TC" | "TO";
export type Timing = "Before purchase" | "Before use" | "Before deployment" | "Ongoing";

export interface ChoiceDef {
  value: string;
  text: string;
  status: ItemStatus;
  mitigation: string | null;
  setsGate?: "G4";
  asks?: "evidence" | "target_date";
  /** Proposed: required for criterion items, optional for recommended-practice items. */
  evidenceRequired?: boolean;
}

export interface StatementDef {
  id: string;
  legacyQ: number;
  title: string;
  feeds: string[];
  timing: TimingProfile;
  track: Track;
  /** Statement wording is a proposal for DoIT review. */
  proposed: true;
  unknownStatus: ItemStatus;
  /** Null means an unknown answer raises a follow-up and does not add this mitigation. */
  unknownMitigation: string | null;
  choices: ChoiceDef[];
}

export interface MitigationDef {
  id: string;
  title: string;
  action: string;
  owner: string;
  sources: string[];
  remaining: string;
  /** True when this mitigation exists only because of recommended-practice items. */
  rpOnly: boolean;
  timing: TimingProfile;
  /** Kept even when the cap of 3 applies, in this priority band (lower runs first). */
  capBand: number;
}

export type AnswerValue = string | string[];

export interface AnswerFile {
  schema_version: string;
  form_version: string;
  rules_version: string;
  saved_at?: string;
  example?: boolean;
  example_label?: string;
  answers: Record<string, AnswerValue>;
}
