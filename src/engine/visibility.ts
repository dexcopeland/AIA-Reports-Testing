import { GROUPS } from "../content/statements";
import type { Answers } from "./answers";
import { has, many, text } from "./answers";

const OVERLAY_OPEN = new Set(["HIPAA", "FERPA", "CJIS", "IRS_PUB_1075", "SSA", "other", "unknown"]);

export function deployment(answers: Answers): string {
  return text(answers, "q17_status");
}

/** Q18 is asked only when a vendor or an outside model is involved. */
export function procurementApplicable(answers: Answers): boolean {
  return text(answers, "q5_builder") !== "state_built";
}

export function procurement(answers: Answers): string {
  if (!procurementApplicable(answers)) return "";
  return text(answers, "q18_procured");
}

/** Pilot and live are the only statuses that ask for a start date and a prior assessment. */
export function deploymentAsksUse(answers: Answers): boolean {
  const status = deployment(answers);
  return status === "pilot" || status === "live";
}

/**
 * Planning and procuring are Not applicable. A saved answer stays in the file and is ignored,
 * except when a saved start date still flags the status conflict.
 */
export function priorAssessment(answers: Answers): string {
  if (deploymentAsksUse(answers) || statusConflict(answers)) return text(answers, "q19_prior");
  return "not_applicable";
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

const GENERATIVE = new Set(["generates_text", "public_chat", "retrieves_documents"]);

function capabilitiesUnclear(answers: Answers): boolean {
  const caps = capabilities(answers);
  return caps.length === 0 || caps.includes("unknown");
}

function methodUnclear(answers: Answers): boolean {
  const method = text(answers, "q6_method");
  return method === "" || method === "unknown" || method === "other" || method === "llm";
}

/**
 * Poisoning is asked when the system may be trained or fine-tuned on agency data.
 * A statistical or rules model whose inputs are public is treated as not that case.
 * Anything less clear stays visible. Proposed.
 */
function poisoningApplies(answers: Answers): boolean {
  if (capabilitiesUnclear(answers) || methodUnclear(answers)) return true;
  const caps = capabilities(answers);
  if (caps.some((id) => GENERATIVE.has(id))) return true;
  if (vendorInvolved(answers) && text(answers, "st16a") === "allowed") return true;
  const method = text(answers, "q6_method");
  if (designFacts(answers).includes("public_inputs_only") && (method === "statistical" || method === "rules_plus_model")) return false;
  return true;
}

/** Proposed fit of each Q22 threat to the Q6 answers. Unclear threats stay visible. */
export function threatApplies(id: string, answers: Answers): boolean {
  if (capabilitiesUnclear(answers)) return true;
  const caps = capabilities(answers);
  const facts = designFacts(answers);
  if (id === "prompt_injection") return caps.some((item) => GENERATIVE.has(item)) || methodUnclear(answers);
  if (id === "poisoned_data") return poisoningApplies(answers);
  if (id === "model_theft") return true;
  if (id === "output_leakage") return true;
  if (id === "unsafe_output_handling") {
    if (caps.includes("acts_in_other_systems")) return true;
    if (facts.includes("outputs_not_passed")) return false;
    return true;
  }
  return true;
}

/** An older file named a processing place that is not the Q6 hosting place, and has not answered the new yes/no. */
export function legacyProcessingPlace(answers: Answers): boolean {
  const where = text(answers, "q15_where");
  return text(answers, "q15_same_place") === "" && where !== "" && where !== text(answers, "q6_hosting");
}

/**
 * What the yes/no control should show. Empty means leave both unselected so a saved place can be confirmed.
 * A blank answer still displays Yes when it does not disagree with the place the report will use.
 */
export function displayedSamePlace(answers: Answers): "yes" | "no" | "" {
  const same = text(answers, "q15_same_place");
  if (same === "yes" || same === "no") return same;
  if (legacyProcessingPlace(answers)) return "";
  return "yes";
}

export function showProcessingPlace(answers: Answers): boolean {
  return text(answers, "q15_same_place") === "no" || legacyProcessingPlace(answers);
}

/**
 * Yes, or a blank answer on a new file, uses the Q6 hosting value.
 * No uses q15_where. An older file that has q15_where and no yes/no answer keeps that value.
 */
export function processingPlace(answers: Answers): { id: string; sameAsRun: boolean } {
  const same = text(answers, "q15_same_place");
  const where = text(answers, "q15_where");
  const runs = text(answers, "q6_hosting");
  if (same === "no") return { id: where, sameAsRun: false };
  if (same === "yes") return { id: runs, sameAsRun: true };
  if (where) return { id: where, sameAsRun: false };
  return { id: runs, sameAsRun: true };
}
