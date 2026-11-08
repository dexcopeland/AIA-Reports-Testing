import { describe, expect, it } from "vitest";
import { APPROVAL_BANNED, PROHIBITED } from "../src/content/rules";
import { BLUF_OUTCOME, buildBluf } from "../src/engine/bluf";
import { evaluate } from "../src/engine/evaluate";
import { buildReport } from "../src/engine/report";
import { loadExampleFile } from "../src/examples/load";
import { buildScenario } from "../src/scenarios/build";
import { SCENARIOS } from "../src/scenarios/catalog";

function sentences(value: string): string[] {
  return value.split(/(?<=[.!?])\s+/).filter(Boolean);
}

describe("bottom line up front", () => {
  it("leads the body for a clean assessment and says nothing needs follow-up", () => {
    const scenario = SCENARIOS.find((item) => item.id === "S01");
    expect(scenario).toBeTruthy();
    const report = buildReport(buildScenario(scenario!));
    const executive = report.documents.find((item) => item.key === "executive");
    expect(executive).toBeTruthy();
    const headings = executive!.blocks
      .filter((block) => block.type === "h2")
      .map((block) => block.text);
    expect(headings[0]).toBe("About this summary");
    expect(headings[1]).toBe("The AI system");
    expect(headings[2]).toBe("Bottom line up front");

    const start = executive!.blocks.findIndex((block) => block.text === "Bottom line up front");
    const summary = executive!.blocks.findIndex(
      (block) => block.text === "What the agency is doing well",
    );
    const bluf = executive!.blocks.slice(start, summary);
    const follow = bluf.findIndex((block) => block.text === "Follow-up steps for the agency");
    expect(follow).toBeGreaterThan(0);
    const takeaway = sentences(
      bluf
        .slice(0, follow)
        .filter((block) => block.type === "p")
        .map((block) => block.text)
        .join(" "),
    );
    expect(takeaway).toHaveLength(3);
    expect(takeaway[0]).toBe(BLUF_OUTCOME.highClean);
    expect(takeaway[1]).toBe("The path is High.");
    expect(takeaway[2]).toContain("this use is High-risk because it impacts");
    expect(takeaway[2]).toMatch(/rights|safety/);
    expect(takeaway[2]).toContain("Q8");
    expect(takeaway[2]).not.toMatch(/intake|\bQ1\b/i);
    expect(takeaway.join(" ")).not.toContain("The risk level is High-risk.");
    expect(bluf.some((block) => block.type === "step")).toBe(false);
    expect(bluf.some((block) => block.text === "No follow-up step is open.")).toBe(true);
    expect(report.checks.find((check) => check.id === "bluf")?.ok).toBe(true);
    expect(report.checks.find((check) => check.id === "links")?.ok).toBe(true);
  });

  it("routes a partial safeguard as ready only with conditions and links the step to that check", () => {
    const scenario = SCENARIOS.find((item) => item.id === "S01");
    expect(scenario).toBeTruthy();
    const file = buildScenario(scenario!);
    file.answers.st11a = "sample";
    delete file.answers.st11a__evidence;
    const report = buildReport(file);
    const executive = report.documents.find((item) => item.key === "executive");
    expect(executive).toBeTruthy();
    const start = executive!.blocks.findIndex((block) => block.text === "Bottom line up front");
    const summary = executive!.blocks.findIndex(
      (block) => block.text === "What the agency is doing well",
    );
    const bluf = executive!.blocks.slice(start, summary);
    const takeaway = bluf
      .filter((block) => block.type === "p")
      .map((block) => block.text)
      .join(" ");
    expect(takeaway).toContain(BLUF_OUTCOME.highConditions);
    expect(takeaway).toContain("The path is High.");
    expect(takeaway).toMatch(/High-risk because it impacts/);
    expect(takeaway).toContain("Q8");
    expect(takeaway).not.toMatch(/not in place|partly in place|intake|\bQ1\b/i);
    expect(takeaway).not.toContain("The risk level is High-risk.");
    const steps = bluf.filter((block) => block.type === "step");
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((step) => (step.text.match(/[.!?]/g) ?? []).length === 1)).toBe(true);
    const c9 = steps.find((step) => step.link === "check_C9");
    expect(c9?.text).toContain("C9");
    expect(c9?.text.length).toBeLessThan(160);
    const anchors = new Set(report.blocks.map((block) => block.anchor).filter(Boolean));
    for (const step of steps) expect(anchors.has(step.link)).toBe(true);
    expect(bluf.some((block) => block.text === "No follow-up step is open.")).toBe(false);
  });

  it("keeps a non-rights, non-safety use with open safeguards off high-risk routing", () => {
    for (const id of ["state-park-schedule", "vendor-library-forecast"]) {
      const file = loadExampleFile(`${id}.json`);
      const result = evaluate(file);
      expect(result.area.rights).toBe(false);
      expect(result.area.safety).toBe(false);
      expect(result.prohibited).toBe(false);
      expect(
        result.criteria.some((item) => item.status === "Gap") ||
          result.rp.some((item) => item.status === "Not yet"),
      ).toBe(true);
      expect(result.path).toBe("general");
      expect(buildBluf(result).sentences[0]).toBe(BLUF_OUTCOME.generalConditions);
      expect(buildBluf(result).sentences[1]).toBe("The path is General.");
      expect(buildBluf(result).steps.length).toBeGreaterThan(0);

      const impacted = structuredClone(file);
      impacted.answers = { ...file.answers, q8_areas: ["benefits_services"] };
      const routed = evaluate(impacted);
      expect(routed.area.rights).toBe(true);
      const routedBluf = buildBluf(routed);
      if (id === "state-park-schedule") {
        expect(routed.path).toBe("high");
        expect(routedBluf.sentences[0]).toBe(BLUF_OUTCOME.highGaps);
        expect(routedBluf.sentences[1]).toBe("The path is High.");
        expect(routedBluf.sentences[2]).toContain("High-risk because it impacts rights");
        expect(routedBluf.sentences[2]).toContain("Q8");
        expect(routedBluf.sentences[2]).toContain("Q10");
        expect(routedBluf.sentences[2]).not.toMatch(/intake|\bQ1\b/i);
      } else {
        expect(routed.path).toBe("general");
        expect(routedBluf.sentences[0]).toBe(BLUF_OUTCOME.generalConditions);
        expect(routedBluf.sentences[1]).toBe("The path is General.");
      }
    }
  });

  it("uses high-risk routing for a prohibited use without approval language", () => {
    const scenario = SCENARIOS.find((item) => item.id === "S20");
    expect(scenario).toBeTruthy();
    const report = buildReport(buildScenario(scenario!));
    const body = report.blocks.map((block) => block.text).join("\n");
    const executive = report.documents.find((item) => item.key === "executive");
    expect(executive).toBeTruthy();
    const start = executive!.blocks.findIndex((block) => block.text === "Bottom line up front");
    const summary = executive!.blocks.findIndex(
      (block) => block.text === "What the agency is doing well",
    );
    const takeaway = executive!.blocks
      .slice(start, summary)
      .filter((block) => block.type === "p")
      .map((block) => block.text)
      .join(" ");
    const result = evaluate(buildScenario(scenario!));
    expect(result.prohibited).toBe(true);
    expect(result.mitigations.some((item) => item.id === "M-PROHIBITED")).toBe(true);
    const published = PROHIBITED.find(
      (item) => item.id === "covert_or_realtime_biometric_id_no_consent",
    );
    expect(published).toBeTruthy();
    expect(body).toContain(published!.label);
    expect(takeaway).toContain(BLUF_OUTCOME.prohibited);
    expect(takeaway).toContain("The path is Prohibited.");
    expect(takeaway).toContain("prohibited use");
    const blufParagraphs = executive!.blocks
      .slice(start, summary)
      .filter((block) => block.type === "p")
      .slice(0, 3)
      .map((block) => block.text);
    expect(blufParagraphs).toHaveLength(3);
    expect(sentences(blufParagraphs.join(" "))).toHaveLength(3);
    expect(takeaway).not.toContain("The risk level is High-risk.");
    expect(report.checks.find((check) => check.id === "bluf")?.ok).toBe(true);
    expect(body).not.toMatch(/\bApproved\b/);
    for (const phrase of APPROVAL_BANNED) expect(body).not.toContain(phrase);
    expect(body).not.toContain("________");
    const steps = report.blocks.filter((block) => block.type === "step");
    const stop = steps.find((step) => step.text.toLowerCase().includes("prohibited"));
    expect(stop?.text).toContain("(Evidence, Prohibited use).");
    expect(stop?.text).not.toContain("Evidence, M");
    const evidence = report.documents.find((item) => item.key === "evidence");
    expect(
      evidence?.blocks.some(
        (block) => block.text === "Prohibited use" && block.anchor === "prohibited",
      ),
    ).toBe(true);
    expect(
      steps.every((step) => step.link && report.blocks.some((block) => block.anchor === step.link)),
    ).toBe(true);
  });
});

describe("high path reason", () => {
  it("does not treat a blank intake reference as the reason a use is High", () => {
    for (const id of ["state-appeal-ranker", "vendor-license-score"]) {
      const file = loadExampleFile(`${id}.json`);
      expect(file.answers.q1_intake).toBe("");
      const result = evaluate(file);
      expect(result.path).toBe("high");
      const reason = buildBluf(result).sentences[2];
      expect(reason, id).toContain("High-risk because it impacts rights");
      expect(reason, id).toContain("Q8");
      expect(reason, id).toContain("Q10");
      expect(reason, id).not.toMatch(/intake|\bQ1\b/i);
      expect(buildBluf(result).steps.some((step) => step.text.includes("intake reference"))).toBe(
        true,
      );
    }
  });

  it("uses a biometric or ranking basis when no rights or safety area is named", () => {
    const file = loadExampleFile("path-general-grounds.json");
    file.answers.q6_capabilities = ["biometric_id"];
    file.answers.q8_areas = ["regulatory_inspection"];
    file.answers.q8_target = "individuals";
    file.answers.q10_role = "recommends";
    const result = evaluate(file);
    expect(result.area.rights).toBe(false);
    expect(result.area.safety).toBe(false);
    expect(result.path).toBe("high");
    const reason = buildBluf(result).sentences[2];
    expect(reason).toContain("basis for a decision or action");
    expect(reason).toContain("Q6");
    expect(reason).toContain("Q10");
    expect(reason).not.toMatch(/impacts rights|impacts safety|intake|\bQ1\b/i);
  });
});

describe("sign-off boxes", () => {
  it("uses a compact Yes/No row per mitigation and boxes only the comment and signature", () => {
    const scenario = SCENARIOS.find((item) => item.id === "S02");
    expect(scenario).toBeTruthy();
    const report = buildReport(buildScenario(scenario!));
    const signs = report.blocks.filter((block) => block.type === "sign");
    expect(signs.length).toBeGreaterThan(1);
    const lead = signs[signs.length - 1];
    expect(lead.fields?.map((field) => field.label)).toEqual([
      "Name",
      "Title (printed role)",
      "Date",
      "Agency Lead signature",
    ]);
    expect(lead.fields?.every((field) => field.boxed)).toBe(true);
    expect(lead.fields?.find((field) => field.label === "Agency Lead signature")?.kind).toBe(
      "signature",
    );
    const acknowledgments = signs.slice(0, -1);
    for (const row of acknowledgments) {
      const fields = row.fields ?? [];
      expect(fields.filter((field) => field.kind === "choice").map((field) => field.label)).toEqual(
        ["Yes", "No"],
      );
      expect(
        new Set(fields.filter((field) => field.kind === "choice").map((field) => field.group)).size,
      ).toBe(1);
      expect(
        fields.some((field) => field.kind === "date" && !field.boxed && field.lines === 1),
      ).toBe(true);
      expect(
        fields.some(
          (field) =>
            field.label === "Comment" &&
            field.kind === "multiline" &&
            field.boxed &&
            field.lines <= 2,
        ),
      ).toBe(true);
      expect(fields.some((field) => field.kind === "choice" && field.boxed)).toBe(false);
    }
    expect(new Set(signs.flatMap((box) => box.fields?.map((field) => field.name) ?? [])).size).toBe(
      signs.reduce((sum, box) => sum + (box.fields?.length ?? 0), 0),
    );
    const body = report.blocks.map((block) => block.text).join("\n");
    expect(body).not.toContain("________");
    expect(body).not.toContain("Our plan and target date");
    expect(body).not.toContain("Acknowledged (Yes / No)");
    expect(acknowledgments.every((row) => /^M\d+ – /.test(row.text))).toBe(true);
    expect(report.checks.find((check) => check.id === "section9")?.ok).toBe(true);
  });
});
