import type { AnswerFile } from "../content/types";
import { certCreditSnapshot } from "./credits";
import { deriveAssessmentPath } from "./path";

/** Store the derived path and certificate credit state on the draft for later report lines. */
export function stampAssessment(file: AnswerFile): AnswerFile {
  const answers = file.answers ?? {};
  const derived = deriveAssessmentPath(answers);
  return {
    ...file,
    assessment_path: derived.path,
    assessment_path_reasons: derived.reasons,
    cert_credits: certCreditSnapshot(answers),
  };
}
