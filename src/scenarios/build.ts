import { FORM_VERSION, RULES_VERSION, SCHEMA_VERSION, type AnswerFile } from "../content/types";
import { STATEMENT_BY_ID } from "../content/statements";
import type { Answers } from "../engine/answers";
import { text } from "../engine/answers";
import { instanceKeys } from "../engine/evaluate";

const EVIDENCE = "Example agency file shows the control for this fictional assessment.";

export interface ScenarioSpec {
  id: string;
  profile: "good" | "poor";
  system: string;
  agency: string;
  answers: Answers;
  requiredGates: string[];
  forbiddenGates: string[];
  deadline: string | null;
  prohibited: boolean;
  priorFact: boolean;
  conflict: boolean;
  minMitigations: number;
  maxMitigations: number;
  note: string;
}

export function buildScenario(spec: ScenarioSpec): AnswerFile {
  const answers: Answers = {
    response_id: `EXAMPLE-${spec.id}`,
    q1_intake: `EXAMPLE-HR-2026-${spec.id}`,
    q2_agency: spec.agency,
    q2_unit: "Example unit (fictional)",
    q2_role: "Agency Lead",
    q3_is_lead: "yes",
    q4_name: spec.system,
    q5_builder: "vendor_product",
    q5_vendor: "Example Vendor (fictional)",
    q5_product: "Example Product",
    q5_version: "1.0-example",
    q5_changes: "None",
    q6_method: "statistical",
    q6_hosting: "state_data_center",
    q6_description: spec.profile === "good"
      ? `Example: ${spec.system} as described for synthetic scenario ${spec.id}. Fictional system. No security settings.`
      : "Example poor answer: it uses AI.",
    q7_purpose: spec.profile === "good"
      ? `Example purpose for ${spec.system}. Staff use the output in the current process. Fictional.`
      : "Faster work.",
    q7b_prohibited: ["none"],
    q8_how: "Example of how the output reaches people.",
    q9_other: "",
    q11_reviewer: spec.profile === "good" ? "Program manager" : "Unknown",
    q12_outside: "yes",
    q13_level: "L1",
    q14_data_types: ["public_data"],
    q14_overlays: ["none"],
    q14_sources: "Example public source list.",
    q15_where: "state_data_center",
    q16_assurances: ["none"],
    q16_cert_scope: "unknown",
    q17_status: "planning",
    q18_procured: "not_yet",
    q19_start: "",
    q19_prior: "not_applicable",
    q20_harm: spec.profile === "good"
      ? "Example: a wrong output could send staff to the wrong case. The cost falls on the person waiting for the service."
      : "Unknown",
    q20_types: spec.profile === "good" ? ["wrong_decision"] : ["unknown"],
    q23_monitor: spec.profile === "good" ? "Program manager" : "",
    q23_incident: spec.profile === "good" ? "Agency information security" : "",
    q23_reassess: spec.profile === "good" ? "Agency Lead" : "",
    q25_confirm: ["confirm"],
    ...spec.answers,
  };
  for (const instance of instanceKeys(answers)) {
    if (text(answers, instance.key)) continue;
    const def = STATEMENT_BY_ID[instance.statementId];
    if (!def) continue;
    if (spec.profile === "poor") {
      answers[instance.key] = "unknown";
      continue;
    }
    const choice = [...def.choices].reverse().find((item) => item.value !== "unknown" && item.value !== "does_not_apply" && (item.status === "Met" || item.status === "In place"));
    if (!choice) continue;
    answers[instance.key] = choice.value;
    if (choice.asks === "evidence") answers[`${instance.key}__evidence`] = EVIDENCE;
  }
  return {
    schema_version: SCHEMA_VERSION,
    form_version: FORM_VERSION,
    rules_version: RULES_VERSION,
    saved_at: "2026-10-28T00:00:00.000Z",
    example: true,
    example_label: `Synthetic test scenario ${spec.id}. Fictional agency and AI system. Example data only.`,
    answers,
  };
}
