import { ASSURANCES, labelOf } from "../content/catalog";
import type { CertCreditSnapshot } from "../content/types";
import type { Answers } from "./answers";
import { many, text } from "./answers";
import type { ResolvedItem } from "./model";
import { vendorInvolved } from "./visibility";

/** Certificates that can shorten overlapping questions. `none` and `unknown` never credit. */
export const CREDITED_CERT_IDS = [
  "soc2",
  "fedramp",
  "stateramp",
  "iso27001",
  "iso42001",
  "aiuc1",
] as const;

export type CreditedCertId = (typeof CREDITED_CERT_IDS)[number];

/**
 * Overlapping questions a certificate can shorten once the product is in scope.
 * These are defaults for this release. Never-waive fields are removed even if listed here.
 */
export const CERT_SHORTEN: Record<CreditedCertId, readonly string[]> = {
  soc2: ["st15a", "st15b", "st15d", "st21d", "st22", "st22f"],
  fedramp: ["st15a", "st15b", "st15c", "st15d", "st21d", "st22", "st22f"],
  stateramp: ["st15a", "st15b", "st15c", "st15d", "st21d", "st22", "st22f"],
  iso27001: ["st15a", "st15b", "st15d", "st21d", "st22", "st22f"],
  iso42001: ["st11d", "st20a", "st21c", "st21e", "st24a"],
  aiuc1: ["st11d", "st20a", "st21c", "st24a"],
};

/** Mitigations softened when a covering certificate is in scope. The mitigation stays; it is not waived. */
export const CERT_SOFTEN: Record<CreditedCertId, readonly string[]> = {
  soc2: ["M-ENCRYPT", "M-SEC", "M-LOG"],
  fedramp: ["M-ENCRYPT", "M-SEC", "M-LOG", "M-PRIVACY"],
  stateramp: ["M-ENCRYPT", "M-SEC", "M-LOG", "M-PRIVACY"],
  iso27001: ["M-ENCRYPT", "M-SEC", "M-LOG"],
  iso42001: ["M-TRAIN", "M-IMPACT", "M-ACCURACY", "M-LOG"],
  aiuc1: ["M-TRAIN", "M-IMPACT", "M-ACCURACY"],
};

/**
 * Asked even when a certificate covers nearby controls.
 * Rights and safety call, human review of consequential outputs, data level and overlays,
 * prohibited use, training on State data, retrieval limits, accuracy for this workflow,
 * and deployment approval.
 */
export const NEVER_WAIVE_FIELDS = new Set([
  "q7b_prohibited",
  "q8_areas",
  "q8_target",
  "q10_role",
  "q11_reviewer",
  "st11a",
  "q13_level",
  "q14_data_types",
  "q14_overlays",
  "st14c",
  "st16a",
  "st21a",
  "q17_status",
  "q19_prior",
  "q19_start",
]);

const CERT_ID_SET = new Set<string>(CREDITED_CERT_IDS);

export function selectedCertIds(answers: Answers): CreditedCertId[] {
  return many(answers, "q16_assurances").filter((id): id is CreditedCertId => CERT_ID_SET.has(id));
}

export function assuranceSelected(answers: Answers): boolean {
  return selectedCertIds(answers).length > 0;
}

export function productInScope(answers: Answers): boolean {
  return text(answers, "q16_cert_scope") === "yes";
}

/** Credit applies only when a vendor certificate covers this product. */
export function certCreditActive(answers: Answers): boolean {
  return vendorInvolved(answers) && productInScope(answers) && selectedCertIds(answers).length > 0;
}

export function shortenedFieldIds(answers: Answers): string[] {
  if (!certCreditActive(answers)) return [];
  const ids = new Set<string>();
  for (const cert of selectedCertIds(answers)) {
    for (const fieldId of CERT_SHORTEN[cert]) {
      if (!NEVER_WAIVE_FIELDS.has(fieldId)) ids.add(fieldId);
    }
  }
  return [...ids].sort();
}

export function certsCoveringField(fieldId: string, answers: Answers): CreditedCertId[] {
  if (!certCreditActive(answers) || NEVER_WAIVE_FIELDS.has(fieldId)) return [];
  return selectedCertIds(answers).filter((cert) => CERT_SHORTEN[cert].includes(fieldId));
}

function statementFieldId(statementId: string): string {
  return `st${statementId}`;
}

export function certCreditSnapshot(answers: Answers): CertCreditSnapshot {
  const certs = selectedCertIds(answers);
  const active = certCreditActive(answers);
  const softened = new Set<string>();
  if (active) {
    for (const cert of certs) {
      for (const id of CERT_SOFTEN[cert]) softened.add(id);
    }
  }
  return {
    active,
    certs,
    product_in_scope: productInScope(answers),
    shortened: shortenedFieldIds(answers),
    softened_mitigations: [...softened].sort(),
  };
}

export function certCreditLabels(certs: readonly string[]): string {
  const labels = certs.map((id) => labelOf(ASSURANCES, id));
  if (labels.length === 0) return "the in-scope certificate";
  if (labels.length === 1) return labels[0] ?? "the in-scope certificate";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

/** One step softer. A certificate does not mark the control met. */
export function applyCertCredit(item: ResolvedItem, answers: Answers): ResolvedItem {
  const certs = certsCoveringField(statementFieldId(item.statementId), answers);
  if (certs.length === 0 || item.notApplicable || item.q6Excluded) return item;
  const next: ResolvedItem = { ...item, credited: true, creditCerts: [...certs] };
  if (next.status === "Gap") next.status = "Partial";
  else if (next.status === "Not yet") next.status = "Partly in place";
  if (next.status === "Met" || next.status === "In place") next.mitigation = null;
  else {
    next.needsFollowup = false;
    next.unanswered = false;
  }
  return next;
}

export function mitigationCreditCerts(
  mitigationId: string,
  triggers: ResolvedItem[],
  answers: Answers,
): CreditedCertId[] {
  if (!certCreditActive(answers)) return [];
  if (!triggers.some((item) => item.credited)) return [];
  return selectedCertIds(answers).filter((cert) => CERT_SOFTEN[cert].includes(mitigationId));
}

export function softenRemaining(remaining: string, certs: readonly string[]): string {
  const names = certCreditLabels(certs);
  return `${remaining} In-scope ${names} covers the baseline for this safeguard. Confirm it applies to this product. The certificate does not close the item by itself.`;
}
