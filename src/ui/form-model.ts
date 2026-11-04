import type { Field } from "../content/form";
import { CONTRACT_TERMS, GROUPS, RELATIONS, STATEMENT_BY_ID, THREATS } from "../content/statements";
import type { Answers } from "../engine/answers";
import { many, text } from "../engine/answers";
import { threatApplies } from "../engine/visibility";

const ROLE_WORDS = ["officer", "lead", "manager", "supervisor", "director", "analyst", "specialist", "coordinator", "chief", "admin", "counsel", "owner"];

export const touchTarget = "min-h-11 h-auto px-3 text-base";

export function sectionStepLabel(index: number, title: string): string {
  return `${index + 1}. ${title.replace("Section ", "").replace(/^\d+: /, "")}`;
}

export function toggleCheck(answers: Answers, id: string, option: string, checked: boolean): string[] {
  const current = new Set(many(answers, id));
  const exclusive = new Set(["none", "unknown", "none_of_these", "not_applicable"]);
  if (checked) {
    if (exclusive.has(option)) {
      current.clear();
      current.add(option);
    } else {
      for (const item of exclusive) current.delete(item);
      current.add(option);
    }
  } else current.delete(option);
  return [...current];
}

export function roleWarning(value: string): string {
  const trimmed = value.trim();
  if (!/^[-A-Za-z']+ [A-Za-z']+$/.test(trimmed)) return "";
  const lower = trimmed.toLowerCase();
  if (ROLE_WORDS.some((word) => lower.includes(word))) return "";
  return "This looks like a person's name. Write a role, such as program manager.";
}

export function statementInstances(field: Field, answers: Answers): { key: string; title: string }[] {
  const id = field.statementId ?? "";
  const def = STATEMENT_BY_ID[id];
  if (!def) return [];
  if (field.repeat === "group") {
    return many(answers, "q9_groups")
      .filter((groupId) => GROUPS.some((group) => group.id === groupId))
      .map((groupId) => ({
        key: `st12e__${groupId}`,
        title: `Access path for ${GROUPS.find((group) => group.id === groupId)?.label ?? groupId}`,
      }));
  }
  if (field.repeat === "term") {
    return CONTRACT_TERMS.map((term) => ({ key: `st16b__${term.id}`, title: `${def.title}: ${term.label}` }));
  }
  if (field.repeat === "threat") {
    return THREATS.filter((threat) => threatApplies(threat.id, answers)).map((threat) => ({
      key: `st22__${threat.id}`,
      title: `${def.title}: ${threat.label}`,
    }));
  }
  return [{ key: `st${id}`, title: field.label }];
}

export function relationOptions(): typeof RELATIONS {
  return RELATIONS;
}

export function statementDefinition(id: string | undefined) {
  return STATEMENT_BY_ID[id ?? ""];
}
