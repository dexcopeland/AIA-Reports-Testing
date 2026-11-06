import { CAPABILITIES } from "../content/catalog";
import type { AssessmentPath } from "../content/types";
import { AREAS, PROHIBITED, RIGHTS_AREAS, SAFETY_AREAS } from "../content/rules";
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

function proseList(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function namedAreas(answers: Answers, ids: readonly string[]): string {
  const picked = new Set(many(answers, "q8_areas"));
  const labels = ids.filter((id) => picked.has(id)).map((id) => AREAS.find((area) => area.id === id)?.label ?? id);
  return proseList(labels);
}

function roleClause(answers: Answers): string {
  const role = text(answers, "q10_role");
  if (role === "decides") return "Q10 says the output decides or acts without a person approving each one";
  if (role === "recommends") return "Q10 says the output recommends or scores and staff decide";
  if (role === "info_only") return "Q10 says the output gives information to staff only";
  if (role === "unknown") return "Q10 is Unknown";
  return "Q10 does not say what role the output plays";
}

function capabilityClause(biometric: boolean, ranking: boolean): string {
  const biometricLabel = CAPABILITIES.find((item) => item.id === "biometric_id")?.label ?? "Identifies people from faces, voices or other body features";
  const rankLabel = CAPABILITIES.find((item) => item.id === "ranks")?.label ?? "Ranks or prioritizes";
  if (biometric && ranking) return `Q6 ${biometricLabel.charAt(0).toLowerCase()}${biometricLabel.slice(1)} and ${rankLabel.charAt(0).toLowerCase()}${rankLabel.slice(1)} individuals`;
  if (biometric) return `Q6 ${biometricLabel.charAt(0).toLowerCase()}${biometricLabel.slice(1)}`;
  return `Q6 ${rankLabel.charAt(0).toLowerCase()}${rankLabel.slice(1)} individuals`;
}

/**
 * High, General, or Prohibited from the gate facts.
 * Certificates are ignored here. They never move High to General.
 */
export function deriveAssessmentPath(answers: Answers): PathDerivation {
  const caps = capabilities(answers);
  const target = text(answers, "q8_target");
  const rights = areaFact(answers, RIGHTS_AREAS);
  const safety = areaFact(answers, SAFETY_AREAS);
  const prohibited = prohibitedFact(answers);
  const basis = basisFact(answers);
  const biometric = caps.includes("biometric_id");
  const individualRanking = caps.includes("ranks") && (target === "individuals" || target === "both");

  if (prohibited === "yes") {
    return { path: "prohibited", reasons: ["A prohibited use is selected."] };
  }

  const reasons: string[] = [];
  if (prohibited === "unknown") reasons.push("Q7 does not say whether a prohibited use applies, so prohibited use is Unknown.");
  if (rights === "unknown" || safety === "unknown") {
    reasons.push("Q8 includes Unknown, so rights impact is Unknown and safety impact is Unknown.");
  }
  if (basis === "unknown") reasons.push("Q10 does not say whether the output is a basis for a decision or action, so that fact is Unknown.");
  if (safety === "yes") reasons.push(`Q8 names ${namedAreas(answers, SAFETY_AREAS)}, so this is a safety impact.`);
  if (rights === "yes" && basis === "yes") {
    reasons.push(`Q8 names ${namedAreas(answers, RIGHTS_AREAS)}, and ${roleClause(answers)}, so this is a rights impact and the output is a basis for a decision or action.`);
  }
  if ((biometric || individualRanking) && basis === "yes") {
    const what = biometric && individualRanking
      ? "biometric identification or individual ranking"
      : biometric
        ? "biometric identification"
        : "individual ranking";
    reasons.push(`${capabilityClause(biometric, individualRanking)}, and ${roleClause(answers)}, so ${what} is a basis for a decision or action.`);
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
