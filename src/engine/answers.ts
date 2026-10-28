import type { AnswerValue } from "../content/types";

export type Answers = Record<string, AnswerValue>;

export function text(answers: Answers, key: string): string {
  const value = answers[key];
  return typeof value === "string" ? value.trim() : "";
}

export function many(answers: Answers, key: string): string[] {
  const value = answers[key];
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function has(answers: Answers, key: string, id: string): boolean {
  return text(answers, key) === id || many(answers, key).includes(id);
}
