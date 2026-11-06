import type { AssessmentPath } from "../content/types";
import { PROHIBITED, RIGHTS_AREAS, SAFETY_AREAS } from "../content/rules";
import type { Answers } from "./answers";
import { many, text } from "./answers";
import { capabilities } from "./visibility";

export interface PathDerivation {
  path: AssessmentPath;
  reasons: string[];
}

type Fact = "yes" | "no" | "unknown" | "unanswered";

function areaFact(answers: Answers, ids: readonly string[]): Fact {
  const picked = many(answers, "q8_areas");
  if (picked.length === 0) return "unanswered";
  if (picked.includes("unknown")) return "unknown";
  if (picked.some((id) => ids.includes(id))) return "yes";
  // "None of these" is an answered negative for both rights and safety.
  // A named area in this list still wins if a saved file contains both.
  if (picked.includes("none")) return "no";
  return "no";
}

function prohibitedFact(answers: Answers): Fact {
  const picked = many(answers, "q7b_prohibited");
  if (picked.length === 0) return "unanswered";
  if (picked.includes("unknown")) return "unknown";
  if (picked.some((id) => PROHIBITED.some((item) => item.id === id))) return "yes";
  if (picked.includes("none")) return "no";
  return "unanswered";
}

/** A basis is an output that decides or that staff use when they decide. Information only is not a basis. */
function basisFact(answers: Answers): Fact {
  const role = text(answers, "q10_role");
  if (role === "decides" || role === "recommends") return "yes";
  if (role === "info_only") return "no";
  if (role === "unknown") return "unknown";
  return "unanswered";
}

/**
 * High, General, or Prohibited from the gate facts.
 * Certificates are ignored here. They never move High to General.
 */
export function deriveAssessmentPath(answers: Answers): PathDerivation {
  const caps = capabilities(answers);
  const target = text(answers, "q8_target");
  const areas = many(answers, "q8_areas");
  const rights = areaFact(answers, RIGHTS_AREAS);
  const safety = areaFact(answers, SAFETY_AREAS);
  const prohibited = prohibitedFact(answers);
  const basis = basisFact(answers);
  const biometric = caps.includes("biometric_id");
  const individualRanking = caps.includes("ranks") && (target === "individuals" || target === "both");
  const identifyingCombo = biometric && areas.includes("identifying_people");

  if (prohibited === "yes" || identifyingCombo) {
    const reasons = [
      ...(prohibited === "yes" ? ["A prohibited use is selected."] : []),
      ...(identifyingCombo ? ["Biometric identification is used where the output identifies people."] : []),
    ];
    return { path: "prohibited", reasons };
  }

  const reasons: string[] = [];
  if (prohibited === "unknown") reasons.push("Prohibited use is Unknown.");
  if (rights === "unknown") reasons.push("Rights impact is Unknown.");
  if (safety === "unknown") reasons.push("Safety impact is Unknown.");
  if (basis === "unknown") reasons.push("Whether the output is a basis for a decision or action is Unknown.");
  if (safety === "yes") reasons.push("The use is safety-impacting.");
  if (rights === "yes" && basis === "yes") reasons.push("A rights area applies and the output is a basis for a decision or action.");
  if ((biometric || individualRanking) && basis === "yes") {
    reasons.push("Biometric identification or individual ranking is a basis for a decision or action.");
  }
  if (reasons.length > 0) return { path: "high", reasons };

  const rankingUnresolved = caps.includes("ranks") && target === "";
  const pending =
    prohibited === "unanswered" ||
    rights === "unanswered" ||
    safety === "unanswered" ||
    basis === "unanswered" ||
    caps.length === 0 ||
    rankingUnresolved;
  if (pending) return { path: "undetermined", reasons: ["The path facts are not complete."] };
  return { path: "general", reasons: ["No High or Prohibited fact applies."] };
}

export function pathNote(path: AssessmentPath): string {
  switch (path) {
    case "undetermined":
      return "Path: not set yet. Answer the path questions. The path comes from those facts.";
    case "general":
      return "Path: General. The short question set is open.";
    case "high":
      return "Path: High. The full question set is open. A certificate does not move this to General.";
    case "prohibited":
      return "Path: Prohibited. A listed use applies, so the full question set stays open. This form does not approve or reject the system.";
    default: {
      const never: never = path;
      return never;
    }
  }
}
