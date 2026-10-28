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
    const bytes = await reportToPdfBytes(report);
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
      "Page 1 of",
    ]) {
      expect(flat).toContain(heading);
    }
    const headings = report.blocks.filter((block) => block.type === "h1" || block.type === "h2").map((block) => block.text);
    for (const heading of headings) expect(flat).toContain(heading);
  });
});
