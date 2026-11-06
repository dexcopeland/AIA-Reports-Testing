import { describe, expect, it } from "vitest";
import { ASSURANCES } from "../src/content/catalog";
import { FIELD_AUDIENCE, SECTIONS, activeSections, visibleFieldIds } from "../src/content/form";
import { FORM_VERSION, RULES_VERSION, SCHEMA_VERSION, type AnswerFile } from "../src/content/types";
import { CREDITED_CERT_IDS, NEVER_WAIVE_FIELDS } from "../src/engine/credits";
import { evaluate } from "../src/engine/evaluate";
import { deriveAssessmentPath } from "../src/engine/path";
import { buildExample } from "../src/examples/build";
import { EXAMPLES } from "../src/examples/catalog";
import { missing } from "../src/ui/app";
import { toggleCheck } from "../src/ui/form-model";

function file(answers: AnswerFile["answers"]): AnswerFile {
  return {
    schema_version: SCHEMA_VERSION,
    form_version: FORM_VERSION,
    rules_version: RULES_VERSION,
    answers,
  };
}

const gate = {
  q6_capabilities: ["predicts"],
  q7b_prohibited: ["none"],
  q8_areas: ["regulatory_inspection"],
  q8_target: "neither",
  q10_role: "info_only",
};

describe("fact-derived path", () => {
  it("stays undetermined until the gate facts are answered", () => {
    expect(deriveAssessmentPath({}).path).toBe("undetermined");
    expect(deriveAssessmentPath({ ...gate, q8_areas: [] }).path).toBe("undetermined");
    expect(deriveAssessmentPath({ q8_areas: ["safety"] }).path).toBe("high");
    expect(deriveAssessmentPath({ ...gate, q6_capabilities: ["ranks"], q8_target: "" }).path).toBe("undetermined");
  });

  it("treats None of these as an answered negative and still routes Unknown and named areas", () => {
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["none"] }).path).toBe("general");
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["none"], q10_role: "decides" }).path).toBe("general");
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["unknown"] }).path).toBe("high");
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["none", "unknown"] }).path).toBe("high");
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["benefits_services"], q10_role: "recommends" }).path).toBe("high");
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["safety"], q10_role: "info_only" }).path).toBe("high");
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["none", "benefits_services"], q10_role: "recommends" }).path).toBe("high");
    expect(toggleCheck({ q8_areas: ["safety", "jobs"] }, "q8_areas", "none", true)).toEqual(["none"]);
    expect(toggleCheck({ q8_areas: ["none"] }, "q8_areas", "benefits_services", true)).toEqual(["benefits_services"]);
  });

  it("routes High on the locked triggers", () => {
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["benefits_services"], q10_role: "recommends" }).path).toBe("high");
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["jobs"], q10_role: "decides" }).path).toBe("high");
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["safety"], q10_role: "info_only" }).path).toBe("high");
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["health"], q10_role: "info_only" }).path).toBe("high");
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["critical_infrastructure"] }).path).toBe("high");
    expect(deriveAssessmentPath({ ...gate, q7b_prohibited: ["unknown"] }).path).toBe("high");
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["unknown"] }).path).toBe("high");
    expect(deriveAssessmentPath({ ...gate, q10_role: "unknown" }).path).toBe("high");
    expect(deriveAssessmentPath({
      ...gate,
      q6_capabilities: ["biometric_id"],
      q8_areas: ["regulatory_inspection"],
      q10_role: "recommends",
    }).path).toBe("high");
    expect(deriveAssessmentPath({
      ...gate,
      q6_capabilities: ["ranks"],
      q8_target: "individuals",
      q8_areas: ["regulatory_inspection"],
      q10_role: "decides",
    }).path).toBe("high");
    expect(deriveAssessmentPath({
      ...gate,
      q6_capabilities: ["ranks"],
      q8_target: "both",
      q10_role: "recommends",
    }).path).toBe("high");
  });

  it("does not force High for level, public chat, a vendor product, or deciding alone", () => {
    expect(deriveAssessmentPath({ ...gate, q13_level: "L4" }).path).toBe("general");
    expect(deriveAssessmentPath({ ...gate, q13_level: "L3", q14_overlays: ["HIPAA"] }).path).toBe("general");
    expect(deriveAssessmentPath({ ...gate, q6_capabilities: ["public_chat"] }).path).toBe("general");
    expect(deriveAssessmentPath({ ...gate, q5_builder: "vendor_product" }).path).toBe("general");
    expect(deriveAssessmentPath({ ...gate, q10_role: "decides" }).path).toBe("general");
    expect(deriveAssessmentPath({
      ...gate,
      q6_capabilities: ["ranks"],
      q8_target: "places_or_groups",
      q10_role: "decides",
    }).path).toBe("general");
    expect(deriveAssessmentPath({ ...gate, q8_areas: ["benefits_services"], q10_role: "info_only" }).path).toBe("general");
    expect(deriveAssessmentPath({
      ...gate,
      q6_capabilities: ["biometric_id"],
      q10_role: "info_only",
    }).path).toBe("general");
    expect(deriveAssessmentPath({
      ...gate,
      q6_capabilities: ["ranks"],
      q8_target: "individuals",
      q10_role: "info_only",
    }).path).toBe("general");
  });

  it("routes a listed prohibited use, and the biometric identifying-people blocker, to Prohibited", () => {
    expect(deriveAssessmentPath({ ...gate, q7b_prohibited: ["social_scoring"] }).path).toBe("prohibited");
    expect(deriveAssessmentPath({
      ...gate,
      q6_capabilities: ["biometric_id"],
      q8_areas: ["identifying_people"],
      q10_role: "info_only",
    }).path).toBe("prohibited");
  });

  it("names the Q8, Q10, or Q6 check that makes the path High", () => {
    const safety = deriveAssessmentPath({ ...gate, q8_areas: ["safety"], q10_role: "info_only" });
    expect(safety.reasons.join(" ")).toContain("Q8");
    expect(safety.reasons.join(" ")).toContain("People's physical safety");
    expect(safety.reasons.join(" ")).toContain("safety impact");

    const rights = deriveAssessmentPath({ ...gate, q8_areas: ["benefits_services"], q10_role: "recommends" });
    expect(rights.reasons.join(" ")).toContain("Q8");
    expect(rights.reasons.join(" ")).toContain("Q10");
    expect(rights.reasons.join(" ")).toContain("rights impact");
    expect(rights.reasons.join(" ")).toContain("Benefits or public services");

    const both = deriveAssessmentPath({ ...gate, q8_areas: ["safety", "jobs"], q10_role: "decides" });
    expect(both.reasons.some((reason) => reason.includes("safety impact"))).toBe(true);
    expect(both.reasons.some((reason) => reason.includes("rights impact"))).toBe(true);

    const ranking = deriveAssessmentPath({
      ...gate,
      q6_capabilities: ["ranks"],
      q8_target: "individuals",
      q10_role: "decides",
    });
    expect(ranking.reasons.join(" ")).toContain("Q6");
    expect(ranking.reasons.join(" ")).toContain("Q10");
    expect(ranking.reasons.join(" ")).toContain("individual ranking is a basis for a decision or action");

    const unknown = deriveAssessmentPath({ ...gate, q10_role: "unknown" });
    expect(unknown.path).toBe("high");
    expect(unknown.reasons.every((reason) => reason.endsWith("Unknown."))).toBe(true);
    expect(unknown.reasons.join(" ")).toContain("Q10");
    expect(unknown.reasons.join(" ")).not.toMatch(/intake|\bQ1\b/);
  });

  it("keeps a High path when in-scope certificates are selected", () => {
    const high = {
      ...gate,
      q5_builder: "vendor_product",
      q8_areas: ["safety"],
      q16_assurances: ["soc2", "iso42001", "aiuc1"],
      q16_cert_scope: "yes",
    };
    expect(deriveAssessmentPath(high).path).toBe("high");
    expect(evaluate(file(high)).path).toBe("high");
  });
});

describe("path form", () => {
  it("classifies every field", () => {
    const ids = SECTIONS.flatMap((section) => section.fields.map((field) => field.id));
    expect(ids.filter((id) => !FIELD_AUDIENCE[id])).toEqual([]);
  });

  it("shows the short core on General and the fuller set on High", () => {
    const general = visibleFieldIds({ ...gate, q5_builder: "state_built", q13_level: "L1" });
    expect(general).toEqual([
      "q2_agency",
      "q2_unit",
      "q2_role",
      "q3_is_lead",
      "q4_name",
      "q5_builder",
      "q5_changes",
      "q6_capabilities",
      "q7_purpose",
      "q7b_prohibited",
      "q8_areas",
      "q8_target",
      "q10_role",
      "q9_groups",
      "q9_other",
      "st11a",
      "q12_outside",
      "q13_level",
      "q14_data_types",
      "q14_overlays",
      "st15b",
      "q16_note",
      "q20_harm",
      "q20_types",
      "st21a",
      "st21b",
      "q23_monitor",
      "q23_incident",
      "st23a",
      "q25_confirm",
    ]);
    expect(general).not.toContain("q1_intake");
    expect(general).not.toContain("q17_status");
    expect(general).not.toContain("st22");
    expect(general).not.toContain("st11b");
    expect(activeSections(gate).map((section) => section.id)).not.toContain("status");

    const high = visibleFieldIds({ ...gate, q8_areas: ["safety"], q5_builder: "state_built" });
    for (const id of ["q1_intake", "q6_method", "q6_description", "q11_reviewer", "st11b", "q17_status", "st22", "st24a"]) {
      expect(high).toContain(id);
    }
    expect(visibleFieldIds({ ...gate, q7b_prohibited: ["social_scoring"], q5_builder: "state_built" })).toContain("q17_status");
  });

  it("asks whether people are told AI is involved only when people outside the agency are affected", () => {
    expect(visibleFieldIds({ ...gate, q12_outside: "yes" })).toContain("st12a");
    expect(visibleFieldIds({ ...gate, q12_outside: "no" })).not.toContain("st12a");
    expect(visibleFieldIds({ ...gate, q12_outside: "yes" })).not.toContain("st12b");
  });
});

describe("vendor certificate credit", () => {
  const vendor = {
    ...gate,
    q5_builder: "vendor_product",
    q13_level: "L2",
    q6_capabilities: ["predicts", "retrieves_documents"],
    q12_outside: "yes",
  };

  it("lists AIUC-1 with the other credited certificates", () => {
    expect(ASSURANCES.map((item) => item.id)).toEqual([...CREDITED_CERT_IDS, "none", "unknown"]);
  });

  it("shortens overlapping questions only when the product is in scope", () => {
    const inScope = visibleFieldIds({ ...vendor, q16_assurances: ["soc2"], q16_cert_scope: "yes" });
    expect(inScope).not.toContain("st15a");
    expect(inScope).not.toContain("st15b");
    expect(inScope).toContain("q16_credit_note");
    for (const id of NEVER_WAIVE_FIELDS) {
      if (id === "st14c" || id === "q17_status" || id === "q19_prior" || id === "q19_start" || id === "q11_reviewer") continue;
      expect(inScope, id).toContain(id);
    }

    const outOfScope = visibleFieldIds({ ...vendor, q16_assurances: ["soc2"], q16_cert_scope: "no" });
    expect(outOfScope).toContain("st15a");
    expect(outOfScope).toContain("st15b");
    expect(outOfScope).not.toContain("q16_credit_note");

    const unknownScope = visibleFieldIds({ ...vendor, q16_assurances: ["iso27001"], q16_cert_scope: "unknown" });
    expect(unknownScope).toContain("st15a");

    const noCert = visibleFieldIds({ ...vendor, q16_assurances: ["none"] });
    expect(noCert).toContain("st15a");
    expect(noCert).not.toContain("q16_cert_scope");
    expect(visibleFieldIds({ ...vendor, q16_assurances: ["soc2"] })).toContain("q16_cert_scope");
  });

  it("keeps never-waive questions on a High path when certificates are in scope", () => {
    const shown = visibleFieldIds({
      ...vendor,
      q8_areas: ["safety"],
      q17_status: "live",
      q16_assurances: ["soc2", "fedramp", "iso42001", "aiuc1"],
      q16_cert_scope: "yes",
    });
    for (const id of ["st11a", "q11_reviewer", "q13_level", "q14_overlays", "q7b_prohibited", "st16a", "st14c", "st21a", "q17_status", "q19_prior"]) {
      expect(shown, id).toContain(id);
    }
    expect(shown).not.toContain("st15a");
    expect(shown).not.toContain("st22");
    expect(shown).not.toContain("st11d");
    expect(shown).not.toContain("st20a");
    expect(deriveAssessmentPath({
      ...vendor,
      q8_areas: ["safety"],
      q16_assurances: ["soc2", "iso42001"],
      q16_cert_scope: "yes",
    }).path).toBe("high");
  });

  it("softens a covered gap and leaves human review untouched", () => {
    const result = evaluate(file({
      ...vendor,
      q16_assurances: ["soc2", "iso27001"],
      q16_cert_scope: "yes",
      st15a: "none",
      st15b: "open",
      st11a: "none",
      st16a: "allowed",
    }));
    const encrypt = result.items.find((item) => item.statementId === "15a");
    expect(encrypt?.credited).toBe(true);
    expect(encrypt?.status).toBe("Partial");
    expect(encrypt?.creditCerts).toEqual(expect.arrayContaining(["soc2", "iso27001"]));
    const review = result.items.find((item) => item.statementId === "11a");
    expect(review?.credited).toBeUndefined();
    expect(review?.status).toBe("Gap");
    const mitigation = result.mitigations.find((item) => item.id === "M-ENCRYPT");
    expect(mitigation?.softened).toBe(true);
    expect(mitigation?.action).toContain("Encrypt the data");
    expect(mitigation?.remaining).toContain("does not close the item by itself");
    expect(result.mitigations.find((item) => item.id === "M-REVIEW")?.softened).toBeUndefined();
    expect(result.mitigations.find((item) => item.id === "M-NOTRAIN")?.softened).toBeUndefined();
    expect(result.certCredits.active).toBe(true);
    expect(result.certCredits.shortened).toEqual(expect.arrayContaining(["st15a", "st15b"]));
    expect(result.path).toBe("general");
  });

  it("does not soften the same gap when the certificate is out of scope", () => {
    const result = evaluate(file({
      ...vendor,
      q16_assurances: ["soc2"],
      q16_cert_scope: "no",
      st15a: "none",
    }));
    expect(result.items.find((item) => item.statementId === "15a")?.status).toBe("Gap");
    expect(result.items.find((item) => item.statementId === "15a")?.credited).toBeUndefined();
    expect(result.certCredits.active).toBe(false);
  });
});

describe("path examples", () => {
  it("loads a High, General, Prohibited, and cert-credited draft with no blank required answers", () => {
    const expected = {
      "path-high-benefits": "high",
      "path-general-grounds": "general",
      "path-prohibited-score": "prohibited",
      "path-cert-vendor": "general",
    } as const;
    for (const [id, path] of Object.entries(expected)) {
      const spec = EXAMPLES.find((item) => item.id === id);
      expect(spec, id).toBeTruthy();
      const draft = buildExample(spec!);
      expect(draft.assessment_path).toBe(path);
      expect(evaluate(draft).path).toBe(path);
      expect(SECTIONS.flatMap((section) => missing(section, draft.answers))).toEqual([]);
    }
    const grounds = buildExample(EXAMPLES.find((item) => item.id === "path-general-grounds")!);
    expect(grounds.answers.q8_areas).toEqual(["none"]);
    expect(evaluate(grounds).path).toBe("general");
    const credited = buildExample(EXAMPLES.find((item) => item.id === "path-cert-vendor")!);
    expect(credited.cert_credits?.active).toBe(true);
    expect(credited.cert_credits?.certs).toEqual(expect.arrayContaining(["soc2", "iso27001", "aiuc1"]));
    expect(visibleFieldIds(credited.answers)).not.toContain("st15a");
    expect(visibleFieldIds(credited.answers)).toContain("st16a");
    expect(visibleFieldIds(credited.answers)).toContain("st11a");
    const highCert = evaluate(buildExample(EXAMPLES.find((item) => item.id === "vendor-eligibility-triage")!));
    expect(highCert.path).toBe("high");
    expect(highCert.certCredits.active).toBe(true);
  });
});
