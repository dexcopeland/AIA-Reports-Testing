import findingsJson from "../../content/findings.json";
import { LEVELS, ROLES, TARGETS, labelOf } from "../content/catalog";
import { AREAS, MITIGATION_BY_ID } from "../content/rules";
import type { ResolvedItem } from "./model";
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

export function statementAnswer(items: ResolvedItem[]): string {
  return items
    .map((item) => {
      const label = itemLabel(item);
      const evidence = item.evidence.trim() ? ` Evidence: ${endSentence(item.evidence)}` : "";
      const dated = item.targetDate ? ` Target date: ${formatDate(item.targetDate)}.` : "";
      return `${label}: ${endSentence(item.choiceText)}${evidence}${dated}`;
    })
    .join(" ");
}

export function joinAnswer(parts: string[]): string {
  const textValue = parts.map((part) => part.trim()).filter(Boolean).join(" ");
  return textValue || "No answer provided";
}

export function q8Answer(answers: Answers): string {
  const areas = many(answers, "q8_areas").map((id) => AREAS.find((area) => area.id === id)?.label ?? id);
  const target = labelOf(TARGETS, text(answers, "q8_target"));
  const how = text(answers, "q8_how");
  return joinAnswer([
    areas.length ? endSentence(`Areas: ${proseList(areas)}`) : "",
    target ? endSentence(`What the output picks: ${target}`) : "",
    how ? endSentence(`How: ${how}`) : "",
  ]);
}

export function q10Answer(answers: Answers): string {
  const role = labelOf(ROLES, text(answers, "q10_role"));
  return role ? endSentence(`Role in decisions: ${role}`) : "";
}

export function q12OutsideAnswer(answers: Answers): string {
  const value = text(answers, "q12_outside");
  if (value === "yes") return "People outside the agency are affected: Yes.";
  if (value === "no") return "People outside the agency are affected: No.";
  return "";
}

export function q13Answer(answers: Answers): string {
  const level = labelOf(LEVELS, text(answers, "q13_level"));
  return level ? endSentence(`Highest data level: ${level}`) : "Highest data level: Unknown.";
}

export function q20Answer(answers: Answers): string {
  const harm = text(answers, "q20_harm");
  return harm ? endSentence(`What could go wrong: ${harm}`) : "";
}

export function areaLabels(ids: string[], allowed: string[]): string {
  const labels = ids.filter((id) => allowed.includes(id)).map((id) => AREAS.find((area) => area.id === id)?.label ?? id);
  return proseList(labels);
}
