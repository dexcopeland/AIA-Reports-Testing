import { unzipSync } from "fflate";
import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";
import { normalizeFile } from "../src/ui/storage";
import { evaluate } from "../src/engine/evaluate";
import { buildReport, documentView } from "../src/engine/report";
import { reportToPdfBytes } from "../src/pdf/build-pdf";
import { packageZipName, reportPackageZip } from "../src/report/zip";
import { buildScenario } from "../src/scenarios/build";
import { SCENARIOS } from "../src/scenarios/catalog";

describe("report package", () => {
  it("round-trips sign-off in the draft JSON and writes it into the executive summary", async () => {
    const scenario = SCENARIOS.find((item) => item.id === "S02");
    expect(scenario).toBeTruthy();
    const file = buildScenario(scenario!);
    const mitigation = evaluate(file).mitigations[0];
    expect(mitigation).toBeTruthy();
    const comment = `A long plan for this fictional system. ${"The reviewer will check each output before it is used. ".repeat(40)}End of the plan.`;
    file.signoff = {
      mitigations: [{ id: mitigation!.id, choice: "yes", date: "2026-12-01", comment }],
      lead_name: "Alex Example",
      lead_title: "Program director",
      lead_date: "2026-12-02",
    };
    const saved = normalizeFile(JSON.parse(JSON.stringify(file)));
    expect(saved.signoff).toEqual(file.signoff);

    const report = buildReport(saved);
    const executive = report.documents.find((item) => item.key === "executive");
    expect(executive).toBeTruthy();
    const commentField = executive!.blocks
      .flatMap((block) => block.fields ?? [])
      .find((field) => field.kind === "multiline" && field.value === comment);
    expect(commentField).toBeTruthy();
    const name = executive!.blocks
      .flatMap((block) => block.fields ?? [])
      .find((field) => field.name === "lead_name");
    expect(name?.value).toBe("Alex Example");
    const signature = executive!.blocks
      .flatMap((block) => block.fields ?? [])
      .find((field) => field.kind === "signature");
    expect(signature?.value ?? "").toBe("");

    const { bytes } = await reportToPdfBytes(documentView(report, executive!));
    const raw = Buffer.from(bytes).toString("latin1");
    const parser = new PDFParse({ data: bytes });
    const text = await parser.getText();
    await parser.destroy();
    const flat = text.text.replace(/\s+/g, " ");
    expect(flat).toContain("Alex Example");
    expect(flat).toContain("Program director");
    expect(flat).toContain("1 December 2026");
    expect(flat).toContain("2 December 2026");
    expect(flat).toContain("End of the plan.");
    expect(flat).toContain("The reviewer will check each output before it is used.");
    expect(raw).toContain("(lead_signature)");
    expect(raw).not.toContain("(lead_name)");
    expect(raw).not.toContain(`(${commentField!.name})`);
  });

  it("zips four PDFs and four Word files named from the system", async () => {
    const scenario = SCENARIOS.find((item) => item.id === "S01");
    expect(scenario).toBeTruthy();
    const report = buildReport(buildScenario(scenario!));
    const { blob, names } = await reportPackageZip(report);
    expect(packageZipName(report.systemName)).toMatch(/-report-package\.zip$/);
    expect(names).toEqual([
      expect.stringMatching(/-1-Executive-Summary\.pdf$/),
      expect.stringMatching(/-1-Executive-Summary\.docx$/),
      expect.stringMatching(/-2-Evidence\.pdf$/),
      expect.stringMatching(/-2-Evidence\.docx$/),
      expect.stringMatching(/-3-Assessment-Submission-Record\.pdf$/),
      expect.stringMatching(/-3-Assessment-Submission-Record\.docx$/),
      expect.stringMatching(/-4-Follow-Up-Actions\.pdf$/),
      expect.stringMatching(/-4-Follow-Up-Actions\.docx$/),
    ]);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual([...names].sort());
    expect(Buffer.from(files[names[0]].subarray(0, 5)).toString("utf8")).toBe("%PDF-");
    expect(files[names[1]][0]).toBe(0x50);
  });
});
