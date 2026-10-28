import { buildScenario, type ScenarioSpec } from "./build";
import { evaluate } from "../engine/evaluate";
import { buildReport } from "../engine/report";

export interface ScenarioDivergence {
  id: string;
  match: boolean;
  gates: string[];
  deadline: string | null;
  mitigations: number;
  lines: string[];
}

export function compareScenario(spec: ScenarioSpec): ScenarioDivergence {
  const file = buildScenario(spec);
  const result = evaluate(file);
  const report = buildReport(file);
  const gates = result.gates.map((gate) => gate.id);
  const lines: string[] = [];
  for (const id of spec.requiredGates) {
    if (!gates.includes(id)) lines.push(`Missing required gate ${id}.`);
  }
  for (const id of spec.forbiddenGates) {
    if (gates.includes(id)) lines.push(`Unexpected gate ${id}.`);
  }
  if (result.deadlineDate !== spec.deadline) lines.push(`Deadline is "${result.deadlineDate ?? "none"}"; expected "${spec.deadline ?? "none"}".`);
  if (result.prohibited !== spec.prohibited) lines.push(`Prohibited flag is ${result.prohibited}; expected ${spec.prohibited}.`);
  if (Boolean(result.priorDeployment) !== spec.priorFact) lines.push(`Prior-deployment fact is ${Boolean(result.priorDeployment)}; expected ${spec.priorFact}.`);
  if (result.statusConflict !== spec.conflict) lines.push(`Status conflict is ${result.statusConflict}; expected ${spec.conflict}.`);
  if (result.mitigations.length < spec.minMitigations || result.mitigations.length > spec.maxMitigations) {
    lines.push(`Mitigation count is ${result.mitigations.length}; expected ${spec.minMitigations} to ${spec.maxMitigations}.`);
  }
  for (const check of report.checks) {
    if (!check.ok && check.id !== "cap") lines.push(`Report check ${check.id} failed: ${check.detail}`);
  }
  const extras = gates.filter((id) => !spec.requiredGates.includes(id) && !spec.forbiddenGates.includes(id));
  if (extras.length) lines.push(`Extra gates (not a failure): ${extras.join(", ")}.`);
  const failures = lines.filter((line) => !line.startsWith("Extra gates"));
  return {
    id: spec.id,
    match: failures.length === 0,
    gates,
    deadline: result.deadlineDate,
    mitigations: result.mitigations.length,
    lines,
  };
}
