import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FORM_VERSION, RULES_VERSION, SCHEMA_VERSION, type AnswerFile } from "../src/content/types";
import { findingTemplates } from "../src/engine/findings";
import { STATEMENTS } from "../src/content/statements";
import { evaluate } from "../src/engine/evaluate";
import { buildReport } from "../src/engine/report";
import { buildScenario } from "../src/scenarios/build";
import { SCENARIOS } from "../src/scenarios/catalog";
import { compareScenario } from "../src/scenarios/compare";

function file(answers: AnswerFile["answers"]): AnswerFile {
  return {
    schema_version: SCHEMA_VERSION,
    form_version: FORM_VERSION,
    rules_version: RULES_VERSION,
    example: true,
    example_label: "Unit test example.",
    answers,
  };
}

const base = {
  q4_name: "Example System (fictional)",
  q5_builder: "vendor_product",
  q6_capabilities: ["ranks"],
  q8_areas: ["safety"],
  q8_target: "neither",
  q10_role: "recommends",
  q12_outside: "no",
  q13_level: "L1",
  q14_data_types: ["public_data"],
  q14_overlays: ["none"],
  q17_status: "planning",
  q18_procured: "not_yet",
  q19_prior: "not_applicable",
  q25_confirm: ["confirm"],
  st11a: "unknown",
  st11b: "unknown",
  st11c: "unknown",
  st11d: "unknown",
  st15b: "unknown",
  st15d: "unknown",
  st16a: "unknown",
  st20a: "unknown",
  st21a: "unknown",
  st21b: "vendor_claim",
  st21c: "unknown",
  st21d: "unknown",
  st21e: "unknown",
  st22f: "unknown",
  st23a: "unknown",
  st23b: "unknown",
  st23c: "unknown",
  st24a: "unknown",
  st24b: "unknown",
};

describe("evaluation engine", () => {
  it("has one findings template for every status", () => {
    const templates = findingTemplates();
    for (const id of ["C1", "C2", "C3"]) {
      expect(templates.criteria[id]["Impact: Yes"]).toEqual(expect.any(String));
      expect(templates.criteria[id]["Impact: No"]).toEqual(expect.any(String));
    }
    for (const id of ["C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12"]) {
      for (const status of ["Met", "Partial", "Gap"]) expect(templates.criteria[id][status]).toEqual(expect.any(String));
    }
    for (const id of ["RP1", "RP2", "RP3", "RP4", "RP5", "RP6", "RP7", "RP8"]) {
      for (const status of ["In place", "Partly in place", "Not yet", "Not applicable"]) {
        expect(templates.rp[id][status]).toEqual(expect.any(String));
      }
    }
  });

  it("publishes a rules index that matches the modules", () => {
    const index = JSON.parse(readFileSync(new URL("../content/rules-index.json", import.meta.url), "utf8")) as {
      rules_version: string;
      statement_count: number;
      proposed_rules: { id: string }[];
    };
    expect(index.rules_version).toBe(RULES_VERSION);
    expect(index.statement_count).toBe(STATEMENTS.length);
    expect(index.proposed_rules.length).toBeGreaterThan(0);
  });

  it("maps every statement set, including the unknown choice", () => {
    expect(STATEMENTS).toHaveLength(32);
    for (const item of STATEMENTS) {
      expect(item.proposed).toBe(true);
      expect(item.choices.some((choice) => choice.value === "unknown")).toBe(true);
    }
  });

  it("quotes the statement that sets the weakest status when criteria are combined", () => {
    const scenario = SCENARIOS.find((item) => item.id === "S01");
    expect(scenario).toBeTruthy();
    const answers = buildScenario(scenario!);
    answers.answers.st11b = "cannot";
    delete answers.answers.st11b__evidence;
    const result = evaluate(answers);
    const c9 = result.criteria.find((item) => item.id === "C9");
    expect(c9?.status).toBe("Gap");
    expect(c9?.found).toContain("Human oversight is absent or not determined");
    expect(c9?.found).toContain("Power to change or stop");
    expect(c9?.found).not.toContain("cannot change outputs");
    expect(c9?.found).not.toContain("written procedure");
    expect(c9?.quote).toContain("cannot change outputs");
    expect(c9?.quote).not.toContain("written procedure");
    expect(c9?.quote).not.toContain(".;");
    const rp4 = result.rp.find((item) => item.id === "RP4");
    expect(rp4?.status).toBe("Not yet");
    expect(rp4?.quote).toContain("cannot change outputs");
    expect(rp4?.found).not.toContain("cannot change outputs");
  });

  it("separates S01 findings from the verbatim answers", () => {
    const scenario = SCENARIOS.find((item) => item.id === "S01");
    const result = evaluate(buildScenario(scenario!));
    const c9 = result.criteria.find((item) => item.id === "C9");
    const rp1 = result.rp.find((item) => item.id === "RP1");
    const c2 = result.criteria.find((item) => item.id === "C2");
    const c3 = result.criteria.find((item) => item.id === "C3");
    expect(c9?.found).toContain("Human oversight is in place");
    expect(c9?.found).not.toContain("following a written procedure");
    expect(c9?.quote).toContain("following a written procedure");
    expect(c9?.quote).toContain("Evidence:");
    expect(rp1?.found).toContain("in writing");
    expect(rp1?.found).not.toContain("A written analysis covers foreseeable misuse");
    expect(rp1?.quote).toContain("A written analysis covers foreseeable misuse");
    expect(c2?.found).toContain("Safety is not affected");
    expect(c2?.quote).toContain("Benefits or public services");
    expect(c2?.quote).not.toContain("No statement was selected");
    expect(c3?.quote).toContain("Benefits or public services");
    expect(c3?.quote).not.toContain("No statement was selected");
    const report = buildReport(buildScenario(scenario!));
    const body = report.blocks.map((block) => block.text).join("\n");
    expect(body).not.toContain(".;");
    expect(body).not.toContain("..");
    expect(body).not.toContain(".\".\n");
    expect(body).toContain("Answer relied on (Q11):");
    expect(report.blocks.some((block) => block.type === "bullet" && block.text.startsWith("Human review before an output takes effect: A named role reviews every output before it takes effect, following a written procedure."))).toBe(true);
    expect(report.blocks.filter((block) => block.type === "bullet").every((block) => !block.text.startsWith("- "))).toBe(true);
    expect(body).toContain("Evidence: Example agency file shows the control for this fictional assessment.");
    const answerLeads = report.blocks.filter((block) => block.text.startsWith("Answer relied on"));
    expect(answerLeads.every((block) => block.text.endsWith("):"))).toBe(true);
    expect(report.blocks.filter((block) => block.type === "bullet" || block.type === "sub").some((block) => /\(Q\d/.test(block.text))).toBe(false);
    const rp2 = result.rp.find((item) => item.id === "RP2");
    expect(rp2?.answerLines.map((line) => line.label)).toEqual([
      "Split of responsibilities",
      "Notice of model changes",
      "Notice of AI security incidents",
    ]);
    expect(body).toContain("Answer relied on (Q16):");
    expect(report.blocks.some((block) => block.type === "bullet" && block.text.startsWith("Split of responsibilities: It is in the signed contract."))).toBe(true);
  });

  it("treats an unknown review as a Gap and keeps the S04-like gates and deadline", () => {
    const result = evaluate(file({
      ...base,
      q6_capabilities: ["predicts", "acts_in_other_systems"],
      q10_role: "decides",
      q17_status: "procuring",
      st16b__model_change_notice: "requested",
    }));
    expect(result.gates.map((gate) => gate.id)).toEqual(expect.arrayContaining(["G2", "G4"]));
    expect(result.criteria.find((item) => item.id === "C9")?.status).toBe("Gap");
    expect(result.criteria.find((item) => item.id === "C4")?.status).toBe("Gap");
    expect(result.deadlineDate).toBe("31 December 2026");
    expect(result.items.find((item) => item.instanceId === "21b")?.status).toBe("Gap");
    expect(result.items.find((item) => item.instanceId === "16b__model_change_notice")?.status).toBe("Partly in place");
    expect(result.followups.some((item) => item.q === 11)).toBe(true);
    expect(result.prohibited).toBe(false);
  });

  it("drops thin evidence to Partial and does not set G4 when every output is reviewed", () => {
    const result = evaluate(file({
      ...base,
      q8_areas: ["benefits_services"],
      q8_target: "places_or_groups",
      q10_role: "recommends",
      q12_outside: "yes",
      q17_status: "live",
      q18_procured: "before_2026_02_01",
      q19_start: "2025-09-01",
      q19_prior: "yes",
      st11a: "every_written",
      st11a__evidence: "Example agency file shows the written review procedure.",
      st21b: "audited",
      st21b__evidence: "yes",
    }));
    expect(result.gates.map((gate) => gate.id)).toEqual(expect.arrayContaining(["G1", "G5"]));
    expect(result.gates.map((gate) => gate.id)).not.toContain("G4");
    expect(result.deadlineDate).toBe("1 July 2027");
    expect(result.items.find((item) => item.instanceId === "11a")?.status).toBe("Met");
    expect(result.items.find((item) => item.instanceId === "21b")?.status).toBe("Partial");
    expect(result.items.find((item) => item.instanceId === "21b")?.evidenceFailed).toBe(true);
  });

  it("does not ask a follow-up when a planned item has a date", () => {
    const dated = evaluate(file({ ...base, st11a: "planned", st11a__date: "2026-12-01", q10_role: "recommends" }));
    const open = evaluate(file({ ...base, st11a: "planned", q10_role: "recommends" }));
    expect(dated.items.find((item) => item.instanceId === "11a")?.needsFollowup).toBe(false);
    expect(open.items.find((item) => item.instanceId === "11a")?.needsFollowup).toBe(true);
  });

  it("keeps G5 off for individuals and G3 off for regulatory inspection alone", () => {
    const places = evaluate(file({ ...base, q8_target: "individuals", q8_areas: ["regulatory_inspection", "safety"] }));
    expect(places.gates.map((gate) => gate.id)).not.toContain("G5");
    expect(places.gates.map((gate) => gate.id)).not.toContain("G3");
    expect(places.gates.map((gate) => gate.id)).toContain("G2");
  });

  it("opens the privacy track for an unknown level and does not invent one", () => {
    const result = evaluate(file({ ...base, q13_level: "unknown", q14_data_types: ["personal_info"] }));
    expect(result.privacyTrack).toBe(true);
    expect(result.criteria.find((item) => item.id === "C10")?.status).toBe("Gap");
    expect(result.criteria.find((item) => item.id === "C10")?.found).toContain("Unknown (not assigned)");
    expect(result.suggestedLevel).toBe("L3");
  });

  it("uses no date for a State-built system and Not applicable for RP2", () => {
    const result = evaluate(file({ ...base, q5_builder: "state_built", q18_procured: "state_built" }));
    expect(result.deadlineDate).toBeNull();
    expect(result.deadlineLine).toContain("DoIT AI Governance will confirm it");
    expect(result.rp.find((item) => item.id === "RP2")?.status).toBe("Not applicable");
  });

  it("does not treat an outside model as State-built for RP2", () => {
    const result = evaluate(file({ ...base, q5_builder: "state_built_outside_model", q18_procured: "state_built" }));
    expect(result.rp.find((item) => item.id === "RP2")?.status).not.toBe("Not applicable");
    expect(result.deadlineDate).toBeNull();
  });

  it("flags a prohibited use without a go or no-go decision", () => {
    const result = evaluate(file({
      ...base,
      q7b_prohibited: ["social_scoring"],
      q17_status: "live",
    }));
    expect(result.prohibited).toBe(true);
    const report = buildReport(file({ ...base, q7b_prohibited: ["social_scoring"], q17_status: "live", q4_name: "Example Scorer (fictional)" }));
    const text = report.blocks.map((block) => block.text).join("\n");
    expect(text).not.toMatch(/\bApproved\b/);
    expect(text).not.toMatch(/no-go decision/i);
    expect(result.mitigations.some((item) => item.id === "M-PROHIBITED" && item.timing === "Before use")).toBe(true);
  });

  it("caps mitigations at 3 when nothing is Gap or Not yet", () => {
    const scenario = SCENARIOS.find((item) => item.id === "S01");
    expect(scenario).toBeTruthy();
    const result = evaluate(buildScenario(scenario!));
    expect(result.wellAnswered).toBe(true);
    expect(result.mitigations.length).toBeLessThanOrEqual(3);
    expect(result.mitigations.filter((item) => item.timing === "Ongoing")).toHaveLength(1);
  });

  it("uses Before use for a live system and Before deployment for planning", () => {
    const live = evaluate(buildScenario(SCENARIOS.find((item) => item.id === "S02")!));
    expect(live.mitigations.every((item) => item.timing === "Before use" || item.timing === "Ongoing")).toBe(true);
    const planning = evaluate(buildScenario(SCENARIOS.find((item) => item.id === "S11")!));
    expect(planning.mitigations.some((item) => item.timing === "Before use")).toBe(false);
  });

  it("keeps a C5 unknown path at Partial and withholds access mitigation for a general effect", () => {
    const result = evaluate(file({
      ...base,
      q9_groups: ["disabilities"],
      q9_rel__disabilities: "affected_in_general",
      q12_outside: "yes",
      st12e__disabilities: "unknown",
    }));
    expect(result.criteria.find((item) => item.id === "C5")?.status).toBe("Partial");
    expect(result.mitigations.some((item) => item.id === "M-ACCESS")).toBe(false);
    expect(result.followups.some((item) => item.q === 12)).toBe(true);
  });

  it("omits the Agency Lead email and blocks nothing in the draft text", () => {
    const report = buildReport(file({
      ...base,
      q3_is_lead: "no",
      q3_lead_role: "Deputy director",
      q3_email: "agency.lead@example.md.gov",
      q2_agency: "Example Agency (fictional)",
    }));
    const text = report.blocks.map((block) => block.text).join("\n");
    expect(text).not.toContain("agency.lead@example.md.gov");
    expect(text).toContain("Draft for DoIT AI Governance review.");
    expect(report.checks.find((check) => check.id === "email")?.ok).toBe(true);
    expect(report.checks.find((check) => check.id === "b7")?.ok).toBe(true);
  });
});

describe("scenario validation", () => {
  it("runs S01 through S24 and records match or divergence", () => {
    const rows = SCENARIOS.map((scenario) => compareScenario(scenario));
    expect(rows).toHaveLength(24);
    expect(rows.map((row) => row.id)).toEqual(SCENARIOS.map((scenario) => scenario.id));
    const failed = rows.filter((row) => !row.match);
    expect(failed, failed.map((row) => `${row.id}: ${row.lines.join(" | ")}`).join("\n")).toEqual([]);
  });
});
