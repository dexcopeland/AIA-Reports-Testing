import type { ItemStatus, Timing, Track } from "../content/types";

export interface ResolvedItem {
  instanceId: string;
  statementId: string;
  legacyQ: number;
  title: string;
  context: string;
  choiceValue: string;
  choiceText: string;
  status: ItemStatus;
  mitigation: string | null;
  evidenceFailed: boolean;
  needsFollowup: boolean;
  unanswered: boolean;
  notApplicable: boolean;
  evidence: string;
  targetDate: string;
  feeds: string[];
  track: Track;
  groupId?: string;
  individual: boolean;
  designFact?: string;
}

export interface GateHit {
  id: string;
  name: string;
  because: string;
  proposed: boolean;
}

export interface CrossCheck {
  id: string;
  message: string;
  proposed: boolean;
}

export interface LiveMitigation {
  id: string;
  title: string;
  action: string;
  owner: string;
  sources: string[];
  remaining: string;
  timing: Timing;
  rpOnly: boolean;
  covers: string[];
  quotes: { q: number; text: string }[];
}

export interface Followup {
  q: number;
  text: string;
  mitigationId: string | null;
}

export interface ConfirmFact {
  q: number;
  text: string;
}

export interface AnswerLine {
  label: string;
  statement: string;
  evidence: string;
  targetDate: string;
}

export interface CriterionResult {
  id: string;
  name: string;
  status: string;
  found: string;
  /** Plain join of the answer lines, kept for checks. The report renders answerLines instead. */
  quote: string;
  qRefs: string;
  answerLines: AnswerLine[];
}

export interface Evaluation {
  rulesVersion: string;
  formVersion: string;
  fingerprint: string;
  responseId: string;
  inputProblems: string[];
  prohibited: boolean;
  prohibitedLabels: string[];
  prohibitedProposed: boolean;
  area: { rights: boolean; safety: boolean; label: string };
  speech: boolean;
  gates: GateHit[];
  dataLevel: string;
  dataLevelLabel: string;
  suggestedLevel: string | null;
  overlays: string[];
  privacyTrack: boolean;
  criteria: CriterionResult[];
  rp: CriterionResult[];
  deadlineDate: string | null;
  deadlineLine: string;
  summaryDeadline: string;
  priorDeployment: string | null;
  crossChecks: CrossCheck[];
  items: ResolvedItem[];
  mitigations: LiveMitigation[];
  followups: Followup[];
  confirmFacts: ConfirmFact[];
  wellAnswered: boolean;
  capApplied: boolean;
  attestation: boolean;
  statusConflict: boolean;
}
