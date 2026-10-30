import { describe, expect, it } from "vitest";
import { APPROVAL_BANNED } from "../src/content/rules";
import { buildReport } from "../src/engine/report";
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
    const headings = report.blocks.filter((block) => block.type === "h2").map((block) => block.text);
    expect(headings[0]).toBe("Bottom line up front");
    expect(headings[1]).toBe("1. Summary");

    const start = report.blocks.findIndex((block) => block.text === "Bottom line up front");
    const summary = report.blocks.findIndex((block) => block.text === "1. Summary");
    const bluf = report.blocks.slice(start, summary);
    const follow = bluf.findIndex((block) => block.text === "Follow-up steps for the agency");
    expect(follow).toBeGreaterThan(0);
    const takeaway = sentences(bluf.slice(0, follow).filter((block) => block.type === "p").map((block) => block.text).join(" "));
    expect(takeaway.length).toBeGreaterThanOrEqual(2);
    expect(takeaway.length).toBeLessThanOrEqual(4);
    expect(takeaway.join(" ")).toContain("The outcome is that the coded safeguards are in place");
    expect(takeaway.join(" ")).toContain("The risk level is High-risk.");
    expect(takeaway.join(" ")).toContain("The single most important reason is");
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
    const start = report.blocks.findIndex((block) => block.text === "Bottom line up front");
    const summary = report.blocks.findIndex((block) => block.text === "1. Summary");
    const bluf = report.blocks.slice(start, summary);
    const takeaway = bluf.filter((block) => block.type === "p").map((block) => block.text).join(" ");
    expect(takeaway).toContain("The outcome is ready only with conditions.");
    expect(takeaway).toContain("The risk level is High-risk.");
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

  it("uses high-risk routing for a prohibited use without approval language", () => {
    const scenario = SCENARIOS.find((item) => item.id === "S20");
    expect(scenario).toBeTruthy();
    const report = buildReport(buildScenario(scenario!));
    const body = report.blocks.map((block) => block.text).join("\n");
    const start = report.blocks.findIndex((block) => block.text === "Bottom line up front");
    const summary = report.blocks.findIndex((block) => block.text === "1. Summary");
    const takeaway = report.blocks.slice(start, summary).filter((block) => block.type === "p").map((block) => block.text).join(" ");
    expect(takeaway).toContain("The outcome is high-risk routing.");
    expect(takeaway).toContain("prohibited use");
    expect(body).not.toMatch(/\bApproved\b/);
    for (const phrase of APPROVAL_BANNED) expect(body).not.toContain(phrase);
    expect(body).not.toContain("________");
    const steps = report.blocks.filter((block) => block.type === "step");
    expect(steps.some((step) => step.text.toLowerCase().includes("prohibited"))).toBe(true);
    expect(steps.every((step) => step.link && report.blocks.some((block) => block.anchor === step.link))).toBe(true);
  });
});

describe("sign-off boxes", () => {
  it("replaces loose acknowledgment lines with one boxed field set per mitigation plus the Agency Lead", () => {
    const scenario = SCENARIOS.find((item) => item.id === "S02");
    expect(scenario).toBeTruthy();
    const report = buildReport(buildScenario(scenario!));
    const signs = report.blocks.filter((block) => block.type === "sign");
    expect(signs.length).toBeGreaterThan(1);
    const lead = signs[signs.length - 1];
    expect(lead.fields?.map((field) => field.label)).toEqual([
      "Agency Lead signature",
      "Name",
      "Title (printed role)",
      "Agency",
      "Date",
    ]);
    expect(lead.fields?.find((field) => field.label === "Agency Lead signature")?.kind).toBe("signature");
    expect(lead.fields?.find((field) => field.label === "Name")?.kind).toBe("text");
    const comments = signs.slice(0, -1);
    expect(comments.every((box) => box.fields?.some((field) => field.label === "Acknowledged (Yes / No)" && field.kind === "text"))).toBe(true);
    expect(comments.every((box) => box.fields?.some((field) => field.label === "Comment" && field.kind === "multiline" && field.lines >= 3))).toBe(true);
    expect(comments.every((box) => box.fields?.some((field) => field.label === "Our plan and target date" && field.kind === "multiline"))).toBe(true);
    expect(new Set(signs.flatMap((box) => box.fields?.map((field) => field.name) ?? [])).size).toBe(signs.reduce((sum, box) => sum + (box.fields?.length ?? 0), 0));
    const body = report.blocks.map((block) => block.text).join("\n");
    expect(body).not.toContain("________");
    expect((body.match(/Acknowledged \(Yes \/ No\)/g) ?? []).length).toBe(comments.length);
    expect(report.checks.find((check) => check.id === "section9")?.ok).toBe(true);
  });
});
