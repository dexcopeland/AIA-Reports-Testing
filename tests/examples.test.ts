import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SECTIONS } from "../src/content/form";
import { STATEMENT_BY_ID } from "../src/content/statements";
import { BLUF_OUTCOME, buildBluf } from "../src/engine/bluf";
import { evaluate } from "../src/engine/evaluate";
import { buildReport } from "../src/engine/report";
import { buildExample } from "../src/examples/build";
import { EXAMPLE_GROUP_LABELS, EXAMPLES } from "../src/examples/catalog";
import { exampleIndex, loadExampleFile } from "../src/examples/load";
import { missing } from "../src/ui/app";

const OPEN = new Set(["Gap", "Partial", "Not yet", "Partly in place"]);

function openFindings(id: string): number {
  const result = evaluate(loadExampleFile(`${id}.json`));
  return [...result.criteria, ...result.rp].filter((item) => OPEN.has(item.status)).length;
}

describe("loadable examples", () => {
  it("ships the state, vendor, and path example groups", () => {
    expect(exampleIndex.groups.map((group) => group.label)).toEqual([
      EXAMPLE_GROUP_LABELS.state,
      EXAMPLE_GROUP_LABELS.vendor,
      EXAMPLE_GROUP_LABELS.path,
    ]);
    expect(exampleIndex.groups.map((group) => group.id)).toEqual(["state", "vendor", "path"]);
    const listed = exampleIndex.groups.flatMap((group) => group.examples.map((item) => item.id));
    expect(listed).toEqual(EXAMPLES.map((spec) => spec.id));
    expect(listed).toHaveLength(14);
  });

  it("reloads a fresh copy after an example is edited", () => {
    const first = loadExampleFile("state-park-schedule.json");
    const originalUnit = first.answers.q2_unit;
    first.answers.q2_unit = "edited unit";
    first.example = false;
    const second = loadExampleFile("state-park-schedule.json");
    expect(second.answers.q2_unit).toBe(originalUnit);
    expect(second.example).toBe(true);
    expect(first.answers.q2_unit).toBe("edited unit");
  });

  it("loads each saved draft through the same normalizer as Continue a saved draft", () => {
    for (const spec of EXAMPLES) {
      const saved = JSON.parse(readFileSync(new URL(`../examples/${spec.id}.json`, import.meta.url), "utf8")) as unknown;
      const loaded = loadExampleFile(`${spec.id}.json`);
      expect(loaded).toEqual(buildExample(spec));
      expect(loaded).toMatchObject({ example: true, answers: (saved as { answers: unknown }).answers });
      const report = buildReport(loaded);
      const result = evaluate(loaded);
      expect(report.blocks.some((block) => block.text.includes(spec.system))).toBe(true);
      expect(result.criteria.map((item) => item.id)).toEqual(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12"]);
      expect(result.rp.map((item) => item.id)).toEqual(["RP1", "RP2", "RP3", "RP4", "RP5", "RP6", "RP7", "RP8"]);
      const bluf = buildBluf(result).sentences.join(" ");
      expect(bluf).toContain("The outcome is");
      expect(bluf).toContain("The path is");
      expect(bluf).not.toContain("The risk level is High-risk.");
      expect(`${spec.title} ${spec.description} ${loaded.example_label ?? ""}`.toLowerCase()).not.toMatch(/\b(good|poor)\b/);
    }
  });

  it("runs from few residual risks to many, with different outcomes, inside each original path", () => {
    for (const group of exampleIndex.groups.filter((item) => item.id === "state" || item.id === "vendor")) {
      const rows = group.examples.map((entry) => {
        const file = loadExampleFile(entry.file);
        const result = evaluate(file);
        const bluf = buildBluf(result);
        return {
          id: entry.id,
          findings: [...result.criteria, ...result.rp].filter((item) => OPEN.has(item.status)).length,
          steps: bluf.steps.length,
          outcome: bluf.sentences[0],
          reason: bluf.sentences[2],
          c1: result.criteria.find((item) => item.id === "C1")?.status,
          c2: result.criteria.find((item) => item.id === "C2")?.status,
          c3: result.criteria.find((item) => item.id === "C3")?.status,
        };
      });
      for (let index = 1; index < rows.length; index += 1) {
        expect(rows[index].findings).toBeGreaterThan(rows[index - 1].findings);
        expect(rows[index].steps).toBeGreaterThan(rows[index - 1].steps);
      }
      expect(rows[0].findings).toBe(0);
      expect(rows[0].steps).toBe(0);
      expect(rows[0].outcome).toContain("coded safeguards are in place");
      expect(rows[1].outcome).toContain("ready only with conditions");
      expect(rows[2].c1).toBe("Impact: No");
      expect(rows[2].c2).toBe("Impact: No");
      expect(rows[2].c3).toBe("Impact: No");
      expect(rows[2].outcome).toContain("ready only with conditions");
      expect(rows[4].outcome).toBe(BLUF_OUTCOME.highGaps);
      expect(new Set(rows.map((row) => row.reason)).size).toBe(rows.length);
      expect(rows[0].c1 === "Impact: Yes" || rows[0].c2 === "Impact: Yes" || rows[0].c3 === "Impact: Yes").toBe(true);
      expect(rows[4].c1 === "Impact: Yes" || rows[4].c2 === "Impact: Yes" || rows[4].c3 === "Impact: Yes").toBe(true);
    }
  });

  it("gives the low-residual examples evidence for every evidence prompt, and thin evidence at the other end", () => {
    for (const group of exampleIndex.groups.filter((item) => item.id === "state" || item.id === "vendor")) {
      const strong = evaluate(loadExampleFile(group.examples[0].file));
      const evidenced = strong.items.filter((item) => {
        if (item.q6Excluded || item.notApplicable) return false;
        const choice = STATEMENT_BY_ID[item.statementId]?.choices.find((row) => row.value === item.choiceValue);
        return choice?.asks === "evidence";
      });
      expect(evidenced.length).toBeGreaterThan(5);
      for (const item of evidenced) {
        expect(item.evidenceFailed).toBe(false);
        expect(item.evidence.trim().split(/\s+/).length).toBeGreaterThanOrEqual(5);
      }
      expect(SECTIONS.flatMap((section) => missing(section, loadExampleFile(group.examples[0].file).answers))).toEqual([]);

      const thin = evaluate(loadExampleFile(group.examples[4].file));
      expect(thin.items.some((item) => item.evidenceFailed || item.unanswered)).toBe(true);
      expect(openFindings(group.examples[4].id)).toBeGreaterThan(openFindings(group.examples[0].id));
    }
  });
});
