import { writeFileSync } from "node:fs";
import { FORM_VERSION, RULES_VERSION, SCHEMA_VERSION } from "../src/content/types";
import { PROPOSED_RULES, MITIGATIONS } from "../src/content/rules";
import { STATEMENTS } from "../src/content/statements";
import { FIXED } from "../src/content/rules";
import { FINDINGS_VERSION } from "../src/engine/findings";

const index = {
  schema_version: SCHEMA_VERSION,
  form_version: FORM_VERSION,
  rules_version: RULES_VERSION,
  statement_count: STATEMENTS.length,
  statements: STATEMENTS.map((item) => ({
    id: item.id,
    legacy_q: item.legacyQ,
    title: item.title,
    feeds: item.feeds,
    timing: item.timing,
    track: item.track,
    proposed: item.proposed,
    choices: item.choices.map((choice) => ({
      value: choice.value,
      status: choice.status,
      mitigation: choice.mitigation,
      asks: choice.asks ?? null,
      sets_gate: choice.setsGate ?? null,
    })),
  })),
  mitigations: MITIGATIONS.map((item) => ({ id: item.id, title: item.title, timing: item.timing, rp_only: item.rpOnly })),
  proposed_rules: PROPOSED_RULES,
  fixed_paragraphs: FIXED.purpose.length,
  findings_version: FINDINGS_VERSION,
};
writeFileSync(new URL("../content/rules-index.json", import.meta.url), `${JSON.stringify(index, null, 2)}\n`);
console.log(`Wrote content/rules-index.json (${STATEMENTS.length} statements).`);
