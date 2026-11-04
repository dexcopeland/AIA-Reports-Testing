import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { reportToDocxBlob } from "../src/docx/build-docx";
import { buildReport, documentView, type ReportDocument } from "../src/engine/report";
import { buildScenario } from "../src/scenarios/build";
import { SCENARIOS } from "../src/scenarios/catalog";

async function documentXml(scenarioId: string, key: ReportDocument["key"]): Promise<string> {
  const scenario = SCENARIOS.find((item) => item.id === scenarioId);
  expect(scenario).toBeTruthy();
  const report = buildReport(buildScenario(scenario!));
  const part = report.documents.find((item) => item.key === key);
  expect(part).toBeTruthy();
  const blob = await reportToDocxBlob(documentView(report, part!));
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return strFromU8(files["word/document.xml"]);
}

describe("Word report", () => {
  it("keeps Times New Roman, real bullets, and boxed content controls for sign-off", async () => {
    const scenario = SCENARIOS.find((item) => item.id === "S01");
    expect(scenario).toBeTruthy();
    const report = buildReport(buildScenario(scenario!));
    const part = report.documents.find((item) => item.key === "executive");
    expect(part).toBeTruthy();
    const blob = await reportToDocxBlob(documentView(report, part!));
    const xml = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))["word/document.xml"]);
    const evidence = await documentXml("S01", "evidence");
    expect(xml).toContain("Times New Roman");
    expect(xml).toContain("Bottom line up front");
    expect(xml).toContain("No follow-up step is open.");
    expect(evidence).toContain("w:numPr");
    expect(xml).not.toContain("________");
    expect(xml).not.toContain("{{cc|");
    const fields = report.blocks.flatMap((block) => block.fields ?? []);
    expect((xml.match(/<w:sdt>/g) ?? []).length).toBe(fields.length);
    expect(xml).toContain('w:tag w:val="lead_signature"');
    expect(xml).toContain('w:alias w:val="Comment"');
    expect(xml).toContain('w:alias w:val="Agency Lead signature"');
    expect(xml).toContain('w:alias w:val="Yes ack_1"');
    expect(xml).toContain('w:alias w:val="No ack_1"');
    expect((xml.match(/<w14:checkbox>/g) ?? []).length).toBe(2);
    expect(xml).toContain("<w:tbl>");
  });

  it("links each follow-up step to a bookmark in the same file", async () => {
    const evidence = await documentXml("S02", "evidence");
    const followup = await documentXml("S02", "followup");
    const bookmarks = new Set([...evidence.matchAll(/w:name="([^"]+)"/g)].map((match) => match[1]));
    expect(bookmarks.has("check_C9")).toBe(true);
    expect(bookmarks.has("sec_4")).toBe(true);
    expect(followup).toContain("Close C9, human oversight, which is not in place (Evidence, C9).");
    expect(followup).toContain("Owner:");
  });
});
