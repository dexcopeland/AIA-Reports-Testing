import { FORM_VERSION, RULES_VERSION, SCHEMA_VERSION, type AnswerFile } from "../content/types";
import { stampAssessment } from "../engine/draft-state";

const COLUMN_TYPES = new Set(["short", "email", "date"]);

export function questionClusters<T extends { legacyQ: number }>(fields: T[]): T[][] {
  const clusters: T[][] = [];
  for (const field of fields) {
    const current = clusters[clusters.length - 1];
    if (current && current[0]?.legacyQ === field.legacyQ) current.push(field);
    else clusters.push([field]);
  }
  return clusters;
}

export function clusterUsesColumns(fields: { type: string }[]): boolean {
  return fields.length > 1 && fields.every((field) => COLUMN_TYPES.has(field.type));
}

/** How far a restored draft can jump: through the first incomplete section, or the last section when every one is complete. */
export function initialMaxReached(missingCounts: number[]): number {
  if (missingCounts.length === 0) return 0;
  const firstGap = missingCounts.findIndex((count) => count > 0);
  if (firstGap === -1) return missingCounts.length - 1;
  return firstGap;
}

/** Remember a section the rail or Back control actually opened, so it stays available if its answers are cleared. */
export function reachedAfterOpen(maxReached: number, index: number): number {
  return Math.max(maxReached, index);
}

export function sectionCanOpen(
  index: number,
  state: { maxReached: number; complete: boolean; reportOpen: boolean; navigationEnabled: boolean },
): boolean {
  if (!state.navigationEnabled) return false;
  if (state.reportOpen || state.complete) return true;
  return index <= state.maxReached;
}

export function reportCanOpen(state: { navigationEnabled: boolean; reportUnlocked: boolean }): boolean {
  return state.navigationEnabled && state.reportUnlocked;
}

/** Snapshot the draft the moment the user leaves the current question or section. */
export function persistAdvance(file: AnswerFile, save: (file: AnswerFile) => void, now = new Date().toISOString()): AnswerFile {
  const next = stampAssessment({
    ...file,
    saved_at: now,
    rules_version: RULES_VERSION,
    form_version: FORM_VERSION,
    schema_version: SCHEMA_VERSION,
  });
  save(next);
  return next;
}
