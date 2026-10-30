import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { reportToDocxBlob } from "../src/docx/build-docx";
import { buildReport } from "../src/engine/report";
import { buildScenario } from "../src/scenarios/build";
import { SCENARIOS } from "../src/scenarios/catalog";

async function documentXml(scenarioId: string): Promise<string> {
  const scenario = SCENARIOS.find((item) => item.id === scenarioId);
  expect(scenario).toBeTruthy();
  const report = buildReport(buildScenario(scenario!));
  const blob = await reportToDocxBlob(report);
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return strFromU8(files["word/document.xml"]);
}

describe("Word report", () => {
  it("keeps Times New Roman, real bullets, and boxed content controls for sign-off", async () => {
    const scenario = SCENARIOS.find((item) => item.id === "S01");
    expect(scenario).toBeTruthy();
    const report = buildReport(buildScenario(scenario!));
    const blob = await reportToDocxBlob(report);
    const xml = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))["word/document.xml"]);
    expect(xml).toContain("Times New Roman");
    expect(xml).toContain("Bottom line up front");
    expect(xml).toContain("No follow-up step is open.");
    expect(xml).toContain("w:numPr");
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
    const xml = await documentXml("S02");
    expect(xml).toContain("The outcome is high-risk routing.");
    const anchors = [...xml.matchAll(/w:anchor="([^"]+)"/g)].map((match) => match[1]);
    const bookmarks = new Set([...xml.matchAll(/w:name="([^"]+)"/g)].map((match) => match[1]));
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) expect(bookmarks.has(anchor)).toBe(true);
    expect(bookmarks.has("check_C9")).toBe(true);
    expect(bookmarks.has("sec_4")).toBe(true);
    expect(xml).toContain("Close C9, human oversight, which is not in place.");
  });
});
