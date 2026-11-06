import { describe, expect, it } from "vitest";
import { SECTIONS, visibleFields } from "../src/content/form";
import { FORM_VERSION, RULES_VERSION, SCHEMA_VERSION, type AnswerFile } from "../src/content/types";
import {
  clusterSpansFull,
  clusterUsesColumns,
  initialMaxReached,
  persistAdvance,
  reachedAfterOpen,
  questionClusters,
  reportCanOpen,
  sectionCanOpen,
} from "../src/ui/shell";

describe("question cards", () => {
  it("groups visible fields that share a question number", () => {
    const clusters = questionClusters(visibleFields(SECTIONS[0]!, {}));
    expect(clusters.map((cluster) => cluster.map((field) => field.id))).toEqual([
      ["q1_intake"],
      ["q2_agency", "q2_unit", "q2_role"],
      ["q3_is_lead"],
    ]);
  });

  it("puts short related answers in columns and keeps long decisions full width", () => {
    expect(clusterUsesColumns([{ type: "short" }, { type: "email" }])).toBe(true);
    expect(clusterUsesColumns([{ type: "short" }])).toBe(false);
    expect(clusterUsesColumns([{ type: "short" }, { type: "paragraph" }])).toBe(false);
    expect(clusterSpansFull([{ type: "radio" }])).toBe(false);
    expect(clusterSpansFull([{ type: "statement" }])).toBe(true);
    expect(clusterSpansFull([{ type: "short" }, { type: "short" }, { type: "short" }])).toBe(true);
  });
});

describe("progress rail", () => {
  it("opens the working section, completed sections, and anything already reached", () => {
    expect(initialMaxReached([1, 1, 1])).toBe(0);
    expect(initialMaxReached([0, 0, 2])).toBe(2);
    expect(initialMaxReached([0, 0, 0])).toBe(2);
    expect(initialMaxReached([])).toBe(0);

    const prior = { maxReached: 1, complete: false, reportOpen: false, navigationEnabled: true };
    expect(sectionCanOpen(1, prior)).toBe(true);
    expect(sectionCanOpen(2, prior)).toBe(false);
    expect(sectionCanOpen(4, { ...prior, complete: true })).toBe(true);
    expect(sectionCanOpen(4, { ...prior, reportOpen: true })).toBe(true);
    expect(sectionCanOpen(0, { ...prior, navigationEnabled: false })).toBe(false);
    expect(reportCanOpen({ navigationEnabled: true, reportUnlocked: true })).toBe(true);
    expect(reportCanOpen({ navigationEnabled: true, reportUnlocked: false })).toBe(false);
    expect(reportCanOpen({ navigationEnabled: false, reportUnlocked: true })).toBe(false);
  });

  it("keeps a later section open after a rail visit even when that section becomes incomplete", () => {
    const restored = initialMaxReached([2, 0, 0]);
    expect(restored).toBe(0);
    const later = { maxReached: restored, complete: true, reportOpen: false, navigationEnabled: true };
    expect(sectionCanOpen(2, later)).toBe(true);

    const visited = reachedAfterOpen(restored, 2);
    expect(visited).toBe(2);
    const cleared = { maxReached: visited, complete: false, reportOpen: false, navigationEnabled: true };
    expect(sectionCanOpen(2, cleared)).toBe(true);
    expect(sectionCanOpen(1, cleared)).toBe(true);
  });
});

describe("advance autosave", () => {
  it("persists the current answers when the draft advances", () => {
    const draft: AnswerFile = {
      schema_version: "0.9.0",
      form_version: "old-form",
      rules_version: "old-rules",
      saved_at: "2020-01-01T00:00:00.000Z",
      example: true,
      example_label: "Keep the label",
      answers: { q2_agency: "Department of Example" },
      signoff: { mitigations: [], lead_name: "Program manager", lead_title: "", lead_date: "" },
    };
    const saved: AnswerFile[] = [];
    const next = persistAdvance(draft, (file) => saved.push(file), "2026-11-05T00:00:00.000Z");

    expect(saved).toEqual([next]);
    expect(next.answers.q2_agency).toBe("Department of Example");
    expect(next.example_label).toBe("Keep the label");
    expect(next.signoff?.lead_name).toBe("Program manager");
    expect(next.saved_at).toBe("2026-11-05T00:00:00.000Z");
    expect(next.schema_version).toBe(SCHEMA_VERSION);
    expect(next.form_version).toBe(FORM_VERSION);
    expect(next.rules_version).toBe(RULES_VERSION);
  });
});
