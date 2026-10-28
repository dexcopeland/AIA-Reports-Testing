import { GROUPS } from "../content/statements";
import type { Answers } from "./answers";
import { has, many, text } from "./answers";

const OVERLAY_OPEN = new Set(["HIPAA", "FERPA", "CJIS", "IRS_PUB_1075", "SSA", "other", "unknown"]);

export function deployment(answers: Answers): string {
  return text(answers, "q17_status");
}

export function procurement(answers: Answers): string {
  return text(answers, "q18_procured");
}

export function dataLevel(answers: Answers): string {
  return text(answers, "q13_level") || "unknown";
}

export function vendorInvolved(answers: Answers): boolean {
  return text(answers, "q5_builder") !== "state_built";
}

export function selectedGroups(answers: Answers): string[] {
  return many(answers, "q9_groups").filter((id) => id !== "unknown" && GROUPS.some((group) => group.id === id));
}

export function outsideYes(answers: Answers): boolean {
  return text(answers, "q12_outside") === "yes";
}

export function outsideContradiction(answers: Answers): boolean {
  if (text(answers, "q12_outside") !== "no") return false;
  return selectedGroups(answers).some((id) => id !== "state_employees");
}

export function privacyTrack(answers: Answers): boolean {
  const level = dataLevel(answers);
  if (level === "L3" || level === "L4" || level === "unknown" || level === "") return true;
  return many(answers, "q14_overlays").some((id) => OVERLAY_OPEN.has(id));
}

export function designFacts(answers: Answers): string[] {
  return many(answers, "q6_design_facts").filter((id) => id !== "none_of_these");
}

export function capabilities(answers: Answers): string[] {
  return many(answers, "q6_capabilities");
}

export function statusConflict(answers: Answers): boolean {
  const status = deployment(answers);
  const planning = status === "planning" || status === "procuring";
  return planning && text(answers, "q19_start").length > 0;
}

export function showStatement(id: string, answers: Answers): boolean {
  if (id === "12a" || id === "12b" || id === "12c") return outsideYes(answers);
  if (id === "12d") return outsideYes(answers) && selectedGroups(answers).includes("limited_english");
  if (id === "12f") return selectedGroups(answers).includes("abuse_risk");
  if (id === "14c") return has(answers, "q6_capabilities", "retrieves_documents");
  if (id === "15a") {
    const level = dataLevel(answers);
    return level === "L2" || level === "L3" || level === "L4" || level === "unknown";
  }
  if (id === "15c") return privacyTrack(answers);
  if (id === "16a" || id === "16b") return vendorInvolved(answers);
  return true;
}

export function inUse(answers: Answers): boolean {
  const status = deployment(answers);
  return status === "pilot" || status === "live" || statusConflict(answers);
}
