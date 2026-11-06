import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";
import { BLUF_OUTCOME } from "../src/engine/bluf";
import { buildReport, documentView, type ReportDoc, type ReportDocument } from "../src/engine/report";
import { reportToPdfBytes } from "../src/pdf/build-pdf";
import { buildScenario } from "../src/scenarios/build";
import { SCENARIOS } from "../src/scenarios/catalog";

async function pdfOf(report: ReportDoc, key: ReportDocument["key"]) {
  const part = report.documents.find((item) => item.key === key);
  expect(part).toBeTruthy();
  const { bytes, warnings } = await reportToPdfBytes(documentView(report, part!));
  const raw = Buffer.from(bytes);
  const parser = new PDFParse({ data: Uint8Array.from(raw) });
  const text = await parser.getText();
  const info = await parser.getInfo();
  await parser.destroy();
  return { bytes: raw, warnings, info, flat: text.text.replace(/\s+/g, " "), raw: raw.toString("latin1") };
}

describe("PDF report", () => {
  it("builds a letter-size PDF for each document in the package", async () => {
    const scenario = SCENARIOS.find((item) => item.id === "S01");
    expect(scenario).toBeTruthy();
    const report = buildReport(buildScenario(scenario!));
    expect(report.documents.map((item) => item.slug)).toEqual([
      "1-Executive-Summary",
      "2-Evidence",
      "3-Assessment-Submission-Record",
      "4-Follow-Up-Actions",
    ]);
    const executive = await pdfOf(report, "executive");
    const evidence = await pdfOf(report, "evidence");
    const submission = await pdfOf(report, "submission");
    const followup = await pdfOf(report, "followup");
    for (const file of [executive, evidence, submission, followup]) {
      expect(file.warnings).toEqual([]);
      expect(file.bytes.byteLength).toBeGreaterThan(8000);
      expect(Buffer.from(file.bytes.subarray(0, 5)).toString("utf8")).toBe("%PDF-");
      expect(file.info.total).toBeGreaterThan(0);
      expect(file.flat).toContain("Page 1 of");
      expect(file.flat).toContain(report.systemName);
      expect(file.flat).toContain(report.reportDate);
    }
    expect(executive.flat).toContain("Executive Summary:");
    expect(executive.flat).toContain("Bottom line up front");
    expect(executive.flat).toContain("What the agency is doing well");
    expect(executive.flat).toContain("Where there is room for improvement");
    expect(executive.flat).toContain("Agency Lead acknowledgment");
    expect(executive.flat).toContain("Agency Lead signature");
    expect(evidence.flat).toContain("Evidence:");
    expect(evidence.flat).toContain("Gates");
    expect(evidence.flat).toContain("What was checked:");
    expect(evidence.flat).toContain("Human oversight is in place");
    expect(evidence.flat).toContain("Recommended practice checks (ISO/IEC 42001 and ISO/IEC 27090)");
    expect(submission.flat).toContain("Assessment Submission Record:");
    expect(submission.flat).toContain("Submission date:");
    expect(submission.flat).toContain("Q1. Intake reference number");
    expect(followup.flat).toContain("Follow-Up Actions:");
    expect(followup.flat).toContain("No follow-up step is open.");
    for (const part of report.documents) {
      const file = part.key === "executive" ? executive : part.key === "evidence" ? evidence : part.key === "submission" ? submission : followup;
      for (const heading of part.blocks.filter((block) => block.type === "h1" || block.type === "h2").map((block) => block.text)) {
        expect(file.flat).toContain(heading);
      }
    }
  });

  it("keeps accuracy ≥ 95% in the PDF and names characters neither font can draw", async () => {
    const scenario = SCENARIOS.find((item) => item.id === "S01");
    expect(scenario).toBeTruthy();
    const answers = buildScenario(scenario!);
    answers.answers.q20_harm = "Example: accuracy ≥ 95% for ∀ groups on the fictional holdout set.";
    answers.answers.q8_how = "Example effect ✓ for this fictional system.";
    const report = buildReport(answers);
    const files = await Promise.all(report.documents.map((part) => pdfOf(report, part.key)));
    const warnings = files.flatMap((file) => file.warnings);
    const flat = files.map((file) => file.flat).join(" ");
    expect(flat).toContain("accuracy ≥ 95%");
    expect(flat).toContain("∀");
    expect(warnings.some((warning) => warning.character === "≥")).toBe(false);
    expect(warnings.some((warning) => warning.character === "∀")).toBe(false);
    const missing = warnings.find((warning) => warning.character === "✓");
    expect(missing?.questions).toContain("Q8");
  });

  it("adds fillable comment, name and signature fields and resolves internal links", async () => {
    const scenario = SCENARIOS.find((item) => item.id === "S02");
    expect(scenario).toBeTruthy();
    const report = buildReport(buildScenario(scenario!));
    const executive = await pdfOf(report, "executive");
    const evidence = await pdfOf(report, "evidence");
    const raw = executive.raw;
    expect(raw).toContain("/FT /Tx");
    expect(raw).toContain("/FT /Sig");
    expect(raw).toContain("/FT /Btn");
    expect(raw).toContain("(lead_signature)");
    expect(raw).toContain("(lead_name)");
    expect(raw).toContain("(lead_date)");
    expect(raw).toContain("(comment_1)");
    expect(raw).toContain("(date_1)");
    expect(raw).toContain("(ack_1)");
    expect(raw).toContain("/Ff 4096");
    expect(raw).toContain("/Ff 49152");
    const flat = executive.flat;
    expect(flat).toContain("Bottom line up front");
    expect(flat).toContain(BLUF_OUTCOME.highGaps);
    expect(flat).toContain("Follow-up steps for the agency");
    expect(flat).not.toContain("Acknowledged (Yes / No)");
    expect(flat).toContain("Agency Lead signature");
    expect(flat).toContain("(Evidence, C9)");
    expect(evidence.flat).toContain("C9 –");
    const steps = report.blocks.filter((block) => block.type === "step");
    expect(steps.length).toBeGreaterThan(0);
    const anchors = new Set(report.blocks.flatMap((block) => block.anchor ? [block.anchor] : []));
    for (const step of steps) expect(step.link && anchors.has(step.link)).toBe(true);
  });
});
