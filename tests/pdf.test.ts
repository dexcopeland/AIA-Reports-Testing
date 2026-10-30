import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";
import { buildReport } from "../src/engine/report";
import { reportToPdfBytes } from "../src/pdf/build-pdf";
import { buildScenario } from "../src/scenarios/build";
import { SCENARIOS } from "../src/scenarios/catalog";

describe("PDF report", () => {
  it("builds a letter-size PDF from the same blocks as the Word report", async () => {
    const scenario = SCENARIOS.find((item) => item.id === "S01");
    expect(scenario).toBeTruthy();
    const report = buildReport(buildScenario(scenario!));
    const { bytes, warnings } = await reportToPdfBytes(report);
    expect(warnings).toEqual([]);
    expect(bytes.byteLength).toBeGreaterThan(8000);
    expect(Buffer.from(bytes.subarray(0, 5)).toString("utf8")).toBe("%PDF-");

    const parser = new PDFParse({ data: bytes });
    const text = await parser.getText();
    const info = await parser.getInfo();
    await parser.destroy();

    expect(info.total).toBeGreaterThan(1);
    const flat = text.text.replace(/\s+/g, " ");
    for (const heading of [
      "Algorithmic Impact Assessment: OutreachMap Grant Outreach Ranker (fictional)",
      "1. Summary",
      "5. Findings by criterion",
      "Recommended practice checks (ISO/IEC 42001 and ISO/IEC 27090)",
      "9. Agency Lead acknowledgment",
      "10. Sources",
      "Appendix: Questions and answers used in this assessment",
      "Human oversight is in place",
      "•",
      "Page 1 of",
    ]) {
      expect(flat).toContain(heading);
    }
    const headings = report.blocks.filter((block) => block.type === "h1" || block.type === "h2").map((block) => block.text);
    for (const heading of headings) expect(flat).toContain(heading);
  });

  it("keeps accuracy ≥ 95% in the PDF and names characters neither font can draw", async () => {
    const scenario = SCENARIOS.find((item) => item.id === "S01");
    expect(scenario).toBeTruthy();
    const answers = buildScenario(scenario!);
    answers.answers.q20_harm = "Example: accuracy ≥ 95% for ∀ groups on the fictional holdout set.";
    answers.answers.q8_how = "Example effect ✓ for this fictional system.";
    const report = buildReport(answers);
    const { bytes, warnings } = await reportToPdfBytes(report);
    const parser = new PDFParse({ data: bytes });
    const text = await parser.getText();
    await parser.destroy();
    const flat = text.text.replace(/\s+/g, " ");
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
    const { bytes } = await reportToPdfBytes(report);
    const raw = Buffer.from(bytes).toString("latin1");
    expect(raw).toContain("/FT /Tx");
    expect(raw).toContain("/FT /Sig");
    expect(raw).toContain("(lead_signature)");
    expect(raw).toContain("(lead_name)");
    expect(raw).toContain("(comment_1)");
    expect(raw).toContain("/Ff 4096");
    const parser = new PDFParse({ data: bytes });
    const text = await parser.getText();
    await parser.destroy();
    const flat = text.text.replace(/\s+/g, " ");
    expect(flat).toContain("Bottom line up front");
    expect(flat).toContain("The outcome is high-risk routing.");
    expect(flat).toContain("Follow-up steps for the agency");
    expect(flat).toContain("Acknowledged (Yes / No)");
    expect(flat).toContain("Agency Lead signature");
    const steps = report.blocks.filter((block) => block.type === "step");
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.link).toBeTruthy();
      expect(raw).toContain(`(${step.link})`);
    }
  });
});
