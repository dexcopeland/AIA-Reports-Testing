import findingsJson from "../../content/findings.json";
import { LEVELS, ROLES, TARGETS, labelOf } from "../content/catalog";
import { AREAS, MITIGATION_BY_ID } from "../content/rules";
import type { AnswerLine, ResolvedItem } from "./model";
import type { Answers } from "./answers";
import { many, text } from "./answers";

interface FindingEntry {
  phrases?: Record<string, string>;
  [status: string]: string | Record<string, string> | undefined;
}

interface FindingsFile {
  findings_version: string;
  criteria: Record<string, FindingEntry>;
  rp: Record<string, FindingEntry>;
}

const FINDINGS = findingsJson as FindingsFile;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const FINDINGS_VERSION = FINDINGS.findings_version;

export function findingTemplates(): FindingsFile {
  return FINDINGS;
}

function endSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function proseList(parts: string[]): string {
  const items = parts.filter(Boolean);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return iso;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

function itemLabel(item: ResolvedItem): string {
  return item.context ? `${item.title} (${item.context})` : item.title;
}

export function buildDetail(items: ResolvedItem[], prefix = ""): string {
  const names = proseList(items.map(itemLabel));
  const dates = proseList([...new Set(items.map((item) => item.targetDate).filter(Boolean).map(formatDate))]);
  const mitigations = proseList(
    [...new Set(items.map((item) => item.mitigation).filter((id): id is string => Boolean(id)))].map(
      (id) => MITIGATION_BY_ID[id]?.title ?? id,
    ),
  );
  const followup = items.some((item) => item.needsFollowup);
  let action = "";
  if (mitigations && followup) action = `The mitigation ${mitigations} applies, and a follow-up applies.`;
  else if (mitigations) action = `The mitigation ${mitigations} applies.`;
  else if (followup) action = "A follow-up applies.";
  const open = names
    ? `Still open: ${names}${dates ? `, with a target date of ${dates}` : ""}.`
    : dates
      ? `The target date is ${dates}.`
      : "";
  return [endSentence(prefix), open, action].filter(Boolean).join(" ");
}

function fill(template: string, slots: Record<string, string>): string {
  const filled = template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => slots[key] ?? "");
  return filled.replace(/[ \t]{2,}/g, " ").replace(/\s+\./g, ".").replace(/ \./g, ".").trim();
}

export function renderFinding(id: string, status: string, slots: Record<string, string>, phrase?: string): string {
  const entry = FINDINGS.criteria[id] ?? FINDINGS.rp[id];
  if (!entry) return `Status for ${id} is ${status}.`;
  if (phrase && entry.phrases?.[phrase]) return entry.phrases[phrase];
  const template = entry[status];
  if (typeof template !== "string") return `Status for ${id} is ${status}.`;
  return fill(template, slots);
}

function line(label: string, statement: string, evidence = "", targetDate = ""): AnswerLine {
  return {
    label,
    statement: endSentence(statement),
    evidence: evidence.trim() ? endSentence(evidence) : "",
    targetDate,
  };
}

export function statementLines(items: ResolvedItem[]): AnswerLine[] {
  return items.map((item) =>
    line(
      item.context || item.title,
      item.choiceText,
      item.evidence,
      item.targetDate ? formatDate(item.targetDate) : "",
    ),
  );
}

export function quoteFromLines(lines: AnswerLine[]): string {
  if (lines.length === 0) return "No answer provided";
  return lines
    .map((item) => {
      const evidence = item.evidence ? ` Evidence: ${item.evidence}` : "";
      const dated = item.targetDate ? ` Target date: ${item.targetDate}.` : "";
      return `${item.label}: ${item.statement}${evidence}${dated}`;
    })
    .join(" ");
}

export function q8Lines(answers: Answers): AnswerLine[] {
  const areas = many(answers, "q8_areas").map((id) => AREAS.find((area) => area.id === id)?.label ?? id);
  const target = labelOf(TARGETS, text(answers, "q8_target"));
  const how = text(answers, "q8_how");
  const lines: AnswerLine[] = [];
  if (areas.length) lines.push(line("Areas", proseList(areas)));
  if (target) lines.push(line("What the output picks", target));
  if (how) lines.push(line("How", how));
  return lines;
}

export function q10Lines(answers: Answers): AnswerLine[] {
  const role = labelOf(ROLES, text(answers, "q10_role"));
  return role ? [line("Role in decisions", role)] : [];
}

export function q12OutsideLines(answers: Answers): AnswerLine[] {
  const value = text(answers, "q12_outside");
  if (value === "yes") return [line("People outside the agency are affected", "Yes")];
  if (value === "no") return [line("People outside the agency are affected", "No")];
  return [];
}

export function q13Lines(answers: Answers): AnswerLine[] {
  const level = labelOf(LEVELS, text(answers, "q13_level"));
  return [line("Highest data level", level || "Unknown")];
}

export function q20Lines(answers: Answers): AnswerLine[] {
  const harm = text(answers, "q20_harm");
  return harm ? [line("What could go wrong", harm)] : [];
}

export function areaLabels(ids: string[], allowed: string[]): string {
  const labels = ids.filter((id) => allowed.includes(id)).map((id) => AREAS.find((area) => area.id === id)?.label ?? id);
  return proseList(labels);
}
