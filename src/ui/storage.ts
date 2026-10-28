import { FORM_VERSION, RULES_VERSION, SCHEMA_VERSION, type AnswerFile } from "../content/types";
import type { Answers } from "../engine/answers";

const KEY = "md-aia-draft-v1";

export function emptyFile(): AnswerFile {
  return {
    schema_version: SCHEMA_VERSION,
    form_version: FORM_VERSION,
    rules_version: RULES_VERSION,
    saved_at: new Date().toISOString(),
    example: false,
    answers: {},
  };
}

export function autosave(file: AnswerFile): void {
  const next = { ...file, saved_at: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function autoload(): AnswerFile | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return normalizeFile(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  localStorage.removeItem(KEY);
}

export function normalizeFile(value: unknown): AnswerFile {
  if (!value || typeof value !== "object") throw new Error("That file is not an answers file.");
  const record = value as Partial<AnswerFile>;
  const schema = String(record.schema_version ?? "");
  if (schema.split(".")[0] !== SCHEMA_VERSION.split(".")[0]) {
    throw new Error(`This file uses schema ${schema || "unknown"}. This app reads schema ${SCHEMA_VERSION}.`);
  }
  const answers = record.answers && typeof record.answers === "object" ? (record.answers as Answers) : {};
  return {
    schema_version: SCHEMA_VERSION,
    form_version: String(record.form_version ?? FORM_VERSION),
    rules_version: RULES_VERSION,
    saved_at: typeof record.saved_at === "string" ? record.saved_at : new Date().toISOString(),
    example: Boolean(record.example),
    example_label: typeof record.example_label === "string" ? record.example_label : undefined,
    answers,
  };
}

export function downloadJson(file: AnswerFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const name = String(file.answers.q4_name ?? "assessment").replace(/[^\w.-]+/g, "-").slice(0, 60);
  link.href = url;
  link.download = `AIA-answers-${name || "draft"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
