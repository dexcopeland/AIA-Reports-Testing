import { SECTIONS, visibleFields, type FormSection } from "../content/form";
import { CONTRACT_TERMS, GROUPS, THREATS } from "../content/statements";
import type { Answers } from "../engine/answers";
import { many, text } from "../engine/answers";
import { displayedSamePlace, threatApplies } from "../engine/visibility";

export function missing(section: FormSection, answers: Answers): string[] {
  const blanks: string[] = [];
  for (const field of visibleFields(section, answers)) {
    if (!field.required || field.type === "info") continue;
    if (field.type === "statement") {
      if (field.repeat === "group") {
        for (const groupId of many(answers, "q9_groups")) {
          if (!GROUPS.some((group) => group.id === groupId)) continue;
          if (!text(answers, `st12e__${groupId}`)) blanks.push(`Access path for ${groupId}`);
        }
      } else if (field.repeat === "term") {
        for (const term of CONTRACT_TERMS) {
          if (!text(answers, `st16b__${term.id}`)) blanks.push(term.label);
        }
      } else if (field.repeat === "threat") {
        for (const threat of THREATS) {
          if (!threatApplies(threat.id, answers)) continue;
          if (!text(answers, `st22__${threat.id}`)) blanks.push(threat.label);
        }
      } else if (!text(answers, `st${field.statementId}`)) blanks.push(field.label);
      continue;
    }
    if (field.type === "groups") {
      const groups = many(answers, field.id).filter((id) => GROUPS.some((group) => group.id === id));
      if (groups.length === 0) blanks.push(field.label);
      for (const groupId of groups) {
        if (!text(answers, `q9_rel__${groupId}`)) blanks.push(`Relation for ${groupId}`);
      }
      continue;
    }
    if (field.type === "check") {
      if (many(answers, field.id).length === 0) blanks.push(field.label);
      continue;
    }
    if (field.id === "q15_same_place" && displayedSamePlace(answers) === "yes" && !text(answers, field.id)) continue;
    if (!text(answers, field.id)) blanks.push(field.label);
  }
  return blanks;
}
