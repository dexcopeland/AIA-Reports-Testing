import { writeFileSync } from "node:fs";
import { SCENARIOS } from "../src/scenarios/catalog";
import { compareScenario } from "../src/scenarios/compare";

const rows = SCENARIOS.map((scenario) => ({ scenario, result: compareScenario(scenario) }));
const matched = rows.filter((row) => row.result.match).length;
const lines = [
  "# Scenario validation (S01–S24)",
  "",
  "Synthetic example answers, labeled as fictional. The engine is compared with the scenario keys on gates, deadline date, prohibited-use flag, prior-deployment fact, status conflict and mitigation count range.",
  "",
  `Matched on those checks: ${matched} of ${rows.length}.`,
  "",
  "A divergence is expected to be read, not hidden. Extra gates that the key allows are noted and are not counted as failures.",
  "The coded answers are a conversion of the prose scenarios. Where a key says a gate is arguable, also acceptable, or possible, an extra gate is listed here and is not a failure.",
  "",
  "| Scenario | Gates | Deadline | Mitigations | Result |",
  "| --- | --- | --- | --- | --- |",
];
for (const row of rows) {
  const deadline = row.result.deadline ?? "No date";
  lines.push(`| ${row.result.id} | ${row.result.gates.join(", ")} | ${deadline} | ${row.result.mitigations} | ${row.result.match ? "Match" : "Diverges"} |`);
}
lines.push("", "## Notes and divergences", "");
for (const row of rows) {
  lines.push(`### ${row.result.id}`);
  lines.push("");
  lines.push(row.scenario.note);
  lines.push("");
  if (row.result.lines.length === 0) lines.push("No difference on the checked items.");
  else lines.push(...row.result.lines.map((line) => `- ${line}`));
  lines.push("");
}
writeFileSync(new URL("../docs/scenario-validation.md", import.meta.url), `${lines.join("\n")}\n`);
console.log(`Wrote docs/scenario-validation.md (${matched}/${rows.length} matched).`);
if (matched !== rows.length) {
  for (const row of rows.filter((item) => !item.result.match)) {
    console.log(`${row.result.id}: ${row.result.lines.join(" | ")}`);
  }
}
