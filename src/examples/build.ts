import {
  FORM_VERSION,
  RULES_VERSION,
  SCHEMA_VERSION,
  type AnswerFile,
  type StatementDef,
} from "../content/types";
import { STATEMENT_BY_ID } from "../content/statements";
import { stampAssessment } from "../engine/draft-state";
import type { Answers } from "../engine/answers";
import { instanceKeys } from "../engine/evaluate";

export interface ExampleSpec {
  id: string;
  group: "state" | "vendor" | "path";
  title: string;
  description: string;
  profile: "strong" | "thin";
  agency: string;
  unit: string;
  system: string;
  artifact: string;
  owner: string;
  answers: Answers;
  /** Instance key, such as st11a or st16b__responsibilities, to the choice value. */
  statements?: Record<string, string>;
  evidence?: Record<string, string>;
  dates?: Record<string, string>;
}

const SAVED_AT = "2026-11-02T00:00:00.000Z";

function defaultValue(profile: ExampleSpec["profile"], def: StatementDef): string {
  switch (profile) {
    case "thin":
      return "unknown";
    case "strong":
      return strongest(def);
    default: {
      const unexpected: never = profile;
      throw new Error(`Unknown example profile ${unexpected}.`);
    }
  }
}

function strongest(def: StatementDef): string {
  const choice = [...def.choices]
    .reverse()
    .find(
      (item) =>
        item.value !== "unknown" &&
        item.value !== "does_not_apply" &&
        (item.status === "Met" || item.status === "In place"),
    );
  if (!choice) throw new Error(`No strongest choice for statement ${def.id}.`);
  return choice.value;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function defaultEvidence(spec: ExampleSpec, statementId: string, context: string): string {
  if (statementId === "16a") {
    return `Signed agreement ${spec.artifact} clause 8.4, executed 3 January 2026, owner: procurement officer. The clause bars training on State data.`;
  }
  if (statementId === "16b") {
    const clause = context.includes("model") ? "6.2" : context.includes("incident") ? "6.3" : "6.1";
    const label = context || "contract term";
    return `Signed agreement ${spec.artifact} clause ${clause}, executed 3 January 2026, owner: procurement officer. ${label} is in the executed contract.`;
  }
  const subject = context ? `${context} (${statementId})` : statementId;
  return `${spec.artifact} record for ${subject}, tested 12 March 2026, owner: ${spec.owner}. The record supports the selected statement.`;
}

export function buildExample(spec: ExampleSpec): AnswerFile {
  const answers: Answers = {
    response_id: `EXAMPLE-${spec.id}`,
    q1_intake: `EXAMPLE-HR-2026-${spec.id}`,
    q2_agency: spec.agency,
    q2_unit: spec.unit,
    q2_role: "Agency Lead",
    q3_is_lead: "yes",
    q4_name: spec.system,
    q5_changes: "None",
    q7b_prohibited: ["none"],
    q9_other: "",
    q15_same_place: "yes",
    q20_types: ["wrong_decision"],
    q23_monitor: "program manager",
    q23_incident: "security specialist",
    q23_reassess: "Agency Lead",
    q25_confirm: ["confirm"],
    ...spec.answers,
  };

  for (const instance of instanceKeys(answers)) {
    const def = STATEMENT_BY_ID[instance.statementId];
    if (!def) throw new Error(`Missing statement ${instance.statementId}.`);
    const override = spec.statements?.[instance.key];
    const value = override ?? defaultValue(spec.profile, def);
    const choice = def.choices.find((item) => item.value === value);
    if (!choice)
      throw new Error(`${spec.id} ${instance.key} is not a choice of ${def.id}: ${value}`);
    answers[instance.key] = value;
    const context = instance.key.includes("__") ? instance.key.split("__").slice(1).join(" ") : "";
    if (choice.asks === "evidence") {
      const supplied = spec.evidence?.[instance.key];
      const line = supplied ?? defaultEvidence(spec, instance.statementId, context);
      if (supplied === undefined && wordCount(line) < 5) {
        throw new Error(
          `${spec.id} evidence for ${instance.key} is thinner than the evidence check.`,
        );
      }
      answers[`${instance.key}__evidence`] = line;
    }
    if (choice.asks === "target_date") {
      answers[`${instance.key}__date`] = spec.dates?.[instance.key] ?? "";
    }
  }

  return stampAssessment({
    schema_version: SCHEMA_VERSION,
    form_version: FORM_VERSION,
    rules_version: RULES_VERSION,
    saved_at: SAVED_AT,
    example: true,
    example_label: "Example data. Fictional agency and AI system. Not a real assessment.",
    answers,
  });
}
