import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";
import { FIXED } from "../src/content/rules";
import { reportToDocxBlob } from "../src/docx/build-docx";
import { BLUF_OUTCOME, buildBluf, pathSentence } from "../src/engine/bluf";
import { NEVER_WAIVE_FIELDS } from "../src/engine/credits";
import { evaluate } from "../src/engine/evaluate";
import { buildReport, documentView } from "../src/engine/report";
import { buildExample } from "../src/examples/build";
import { EXAMPLES } from "../src/examples/catalog";
import { reportToPdfBytes } from "../src/pdf/build-pdf";
import { buildScenario } from "../src/scenarios/build";
import { SCENARIOS } from "../src/scenarios/catalog";

const BANNER = "Agency draft — not approval. Send DoIT the signed Executive Summary.";

const INVENTORY_FIELDS = [
  "Name of the system",
  "Vendor",
  "Capabilities",
  "Purpose and intended uses",
  "Impact assessment before deployment",
  "Decision role",
  "Summary of this impact assessment",
];

function example(id: string) {
  const spec = EXAMPLES.find((item) => item.id === id);
  expect(spec, id).toBeTruthy();
  return buildExample(spec!);
}

function scenario(id: string) {
  const spec = SCENARIOS.find((item) => item.id === id);
  expect(spec, id).toBeTruthy();
  return buildScenario(spec!);
}

describe("report packaging", () => {
  it("uses one agency draft banner and drops DoIT-review framing", () => {
    expect(FIXED.draftBanner).toBe(BANNER);
    const report = buildReport(example("path-high-benefits"));
    for (const part of report.documents) {
      expect(part.blocks.find((block) => block.type === "note")?.text).toBe(BANNER);
    }
    const sources = [
      "../src/ui/AssessmentApp.tsx",
      "../src/ui/screens.tsx",
      "../src/engine/report.ts",
      "../src/content/rules.ts",
    ];
    for (const path of sources) {
      const text = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(text, path).not.toContain("Draft for DoIT AI Governance review");
      expect(text, path).not.toContain("for DoIT AI Governance review");
    }
    expect(readFileSync(new URL("../src/ui/AssessmentApp.tsx", import.meta.url), "utf8")).toContain(
      "{FIXED.draftBanner}",
    );
    expect(readFileSync(new URL("../src/ui/screens.tsx", import.meta.url), "utf8")).toContain(
      "{FIXED.draftBanner}",
    );
  });

  it("states the executive purpose for the agency, separate from the system purpose", () => {
    const file = example("path-general-grounds");
    const report = buildReport(file);
    const executive = report.documents.find((item) => item.key === "executive");
    expect(executive).toBeTruthy();
    const purpose = FIXED.purpose[0];
    expect(purpose).toContain("This summary is for the agency.");
    expect(purpose).toContain("It is not an approval");
    expect(purpose).toContain("Assign an owner and a target date");
    expect(purpose).toContain("The Agency Lead signs");
    expect(purpose).toContain("Keep the full report package in the agency's records.");
    expect(purpose).toContain("Send DoIT a copy of the signed Executive Summary.");
    expect(executive!.blocks.some((block) => block.text === purpose)).toBe(true);
    const systemPurpose = executive!.blocks.find((block) => block.text.startsWith("Purpose:"));
    expect(systemPurpose?.text).toContain(String(file.answers.q7_purpose));
    expect(systemPurpose?.text).not.toContain("This summary is for the agency.");
    const about = executive!.blocks.findIndex((block) => block.text === "About this summary");
    const system = executive!.blocks.findIndex((block) => block.text === "The AI system");
    expect(about).toBeGreaterThanOrEqual(0);
    expect(system).toBeGreaterThan(about);
  });

  it("locks the seven BLUF lines to outcome, path, and primary reason", () => {
    const unknowns = example("path-general-grounds");
    unknowns.answers.q10_role = "unknown";
    const partial = scenario("S01");
    partial.answers.st11a = "sample";
    delete partial.answers.st11a__evidence;
    const cases = [
      {
        file: example("path-prohibited-score"),
        outcome: BLUF_OUTCOME.prohibited,
        path: "The path is Prohibited.",
      },
      { file: scenario("S02"), outcome: BLUF_OUTCOME.highGaps, path: "The path is High." },
      { file: partial, outcome: BLUF_OUTCOME.highConditions, path: "The path is High." },
      { file: scenario("S01"), outcome: BLUF_OUTCOME.highClean, path: "The path is High." },
      {
        file: example("state-park-schedule"),
        outcome: BLUF_OUTCOME.generalConditions,
        path: "The path is General.",
      },
      {
        file: example("path-general-grounds"),
        outcome: BLUF_OUTCOME.generalClean,
        path: "The path is General.",
      },
      { file: unknowns, outcome: BLUF_OUTCOME.highUnknowns, path: "The path is High." },
    ] as const;
    expect(new Set(cases.map((item) => item.outcome)).size).toBe(7);
    for (const item of cases) {
      const result = evaluate(item.file);
      const bluf = buildBluf(result);
      expect(bluf.sentences, item.outcome).toHaveLength(3);
      expect(bluf.sentences[0], item.outcome).toBe(item.outcome);
      expect(bluf.sentences[1], item.outcome).toBe(item.path);
      expect(bluf.sentences[1], item.outcome).toBe(pathSentence(result.path));
      expect(bluf.sentences[2], item.outcome).toContain("The single most important reason is");
      expect(bluf.sentences.join(" "), item.outcome).not.toContain("The risk level is High-risk.");
      expect(bluf.sentences.join(" "), item.outcome).not.toMatch(/intake|\bQ1\b/i);
      if (item.path === "The path is High.") {
        expect(bluf.sentences[2], item.outcome).toContain("High-risk because");
        expect(bluf.sentences[2], item.outcome).not.toMatch(/not in place|partly in place/);
        if (item.outcome === BLUF_OUTCOME.highUnknowns) {
          expect(bluf.sentences[2], item.outcome).toMatch(/Unknown/);
          expect(bluf.sentences[2], item.outcome).toMatch(/Q8|Q10|Q7/);
        } else {
          expect(bluf.sentences[2], item.outcome).toMatch(/impacts rights|impacts safety/);
          expect(bluf.sentences[2], item.outcome).toContain("Q8");
        }
      }
      const report = buildReport(item.file);
      expect(report.checks.find((check) => check.id === "bluf")?.ok, item.outcome).toBe(true);
    }
    const unknownResult = evaluate(unknowns);
    expect(unknownResult.pathReasons.every((reason) => reason.endsWith("Unknown."))).toBe(true);
    expect(buildBluf(unknownResult).sentences[2]).toContain("Unknown");
  });

  it("prints the § 3.5-803(b) inventory on its own page for High and omits it for General", () => {
    const high = buildReport(example("path-high-benefits"));
    const executive = high.documents.find((item) => item.key === "executive");
    expect(executive).toBeTruthy();
    const heading = executive!.blocks.findIndex(
      (block) => block.text === "Inventory under SF&P § 3.5-803(b)",
    );
    expect(heading).toBeGreaterThan(0);
    expect(executive!.blocks[heading - 1]?.type).toBe("break");
    const table = executive!.blocks[heading + 1];
    expect(table?.type).toBe("table");
    expect(table?.rows?.map((row) => row.field)).toEqual(INVENTORY_FIELDS);
    expect(table?.rows?.find((row) => row.field === "Name of the system")?.value).toBe(
      "Benefits Queue Helper (fictional)",
    );
    expect(table?.rows?.find((row) => row.field === "Vendor")?.value).toBe(
      "Not applicable. Built by the State.",
    );
    expect(table?.rows?.find((row) => row.field === "Capabilities")?.value).toContain(
      "Ranks or prioritizes",
    );
    expect(
      table?.rows?.find((row) => row.field === "Summary of this impact assessment")?.value,
    ).toContain("The path is High.");
    expect(executive!.blocks.some((block) => block.text.startsWith("Capabilities:"))).toBe(true);

    const general = buildReport(example("path-general-grounds"));
    const generalExec = general.documents.find((item) => item.key === "executive");
    expect(generalExec?.blocks.some((block) => block.type === "table")).toBe(false);
    expect(generalExec?.blocks.some((block) => block.type === "break")).toBe(false);
    expect(generalExec?.blocks.some((block) => block.text.includes("§ 3.5-803(b)"))).toBe(false);
    expect(generalExec?.blocks.some((block) => block.text.startsWith("Capabilities:"))).toBe(true);

    const prohibited = buildReport(example("path-prohibited-score"));
    expect(
      prohibited.documents
        .find((item) => item.key === "executive")
        ?.blocks.some((block) => block.type === "table"),
    ).toBe(false);
  });

  it("renders the High inventory as a Field | Value table in PDF and Word", async () => {
    const report = buildReport(example("path-high-benefits"));
    const part = report.documents.find((item) => item.key === "executive");
    expect(part).toBeTruthy();
    const view = documentView(report, part!);
    const { bytes, warnings } = await reportToPdfBytes(view);
    expect(warnings).toEqual([]);
    const parser = new PDFParse({ data: Uint8Array.from(bytes) });
    const text = await parser.getText();
    await parser.destroy();
    const flat = text.text.replace(/\s+/g, " ");
    expect(flat).toContain("Inventory under SF&P § 3.5-803(b)");
    expect(flat).toContain("Field");
    expect(flat).toContain("Value");
    expect(flat).toContain("Name of the system");
    expect(flat).toContain("Benefits Queue Helper (fictional)");

    const blob = await reportToDocxBlob(view);
    const xml = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))["word/document.xml"]);
    expect(xml).toContain('w:type="page"');
    expect(xml).toContain("Inventory under SF&amp;P § 3.5-803(b)");
    expect(xml).toContain("Field");
    expect(xml).toContain("Value");
    expect(xml).toContain("Name of the system");
    expect(xml).toContain("<w:tbl>");
  });

  it("shows Credited (in-scope certificate) in Evidence and does not call a certificate Met by the agency", () => {
    expect(NEVER_WAIVE_FIELDS.has("st11a")).toBe(true);
    expect(NEVER_WAIVE_FIELDS.has("st15a")).toBe(false);
    const file = example("path-cert-vendor");
    file.answers.st15a = "none";
    delete file.answers.st15a__evidence;
    const result = evaluate(file);
    const encrypt = result.items.find((item) => item.statementId === "15a");
    const review = result.items.find((item) => item.statementId === "11a");
    expect(encrypt?.credited).toBe(true);
    expect(encrypt?.status).toBe("Partial");
    expect(review?.credited).toBeUndefined();
    expect(review?.status).not.toBe("Met by agency");
    const evidence = buildReport(file).documents.find((item) => item.key === "evidence");
    expect(evidence).toBeTruthy();
    const blocks = evidence!.blocks;
    const text = blocks.map((block) => block.text).join("\n");
    expect(text).toContain("Credited (in-scope SOC 2 and ISO/IEC 27001).");
    expect(text).not.toContain("Met by agency");
    const encryption = blocks.findIndex(
      (block) =>
        block.type === "bullet" && block.text.startsWith("Encryption at rest and in transit:"),
    );
    expect(encryption).toBeGreaterThan(0);
    const encryptionFollows = blocks.slice(encryption + 1, encryption + 4);
    expect(
      encryptionFollows.some(
        (block) => block.text === "Credited (in-scope SOC 2 and ISO/IEC 27001).",
      ),
    ).toBe(true);
    const human = blocks.findIndex(
      (block) =>
        block.type === "bullet" &&
        block.text.startsWith("Human review before an output takes effect:"),
    );
    expect(human).toBeGreaterThan(0);
    const nextBullet = blocks.findIndex((block, index) => index > human && block.type === "bullet");
    const humanFollows = blocks.slice(human + 1, nextBullet === -1 ? undefined : nextBullet);
    expect(humanFollows.some((block) => block.text.includes("Credited (in-scope"))).toBe(false);
    const practice = blocks.find(
      (block) => block.type === "label" && block.text.startsWith("RP1 "),
    );
    expect(practice?.text).toContain("Credited (in-scope AIUC-1)");
    expect(practice?.text).not.toContain("Met");
  });
});
