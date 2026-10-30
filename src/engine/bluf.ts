import type { Evaluation } from "./model";

export interface FollowStep {
  text: string;
  link: string;
}

export interface BlufCopy {
  sentences: string[];
  steps: FollowStep[];
}

const CROSS_STEPS: Record<string, string> = {
  "status-conflict": "Resolve the clash between the deployment status and the start date in Section 4.",
  "outside-people": "Align who is affected in Section 4, where the group answers disagree.",
  "info-only-acts": "Resolve the clash in Section 4 between information-only use and output sent to other systems.",
  "level-mismatch": "Confirm the data level in Section 4 and apply the higher safeguards until it is confirmed.",
  "info-only-auto": "Resolve the clash in Section 4 between information-only use and outputs with no review.",
};

const FOLLOW_STEPS: Record<number, FollowStep> = {
  1: { link: "sec_1", text: "Record the intake reference in Section 1." },
  7: { link: "sec_4", text: "Say whether a prohibited use applies, as Section 4 records." },
  9: { link: "check_C5", text: "Name the affected groups for C5." },
  10: { link: "check_C4", text: "State the decision role for C4." },
  11: { link: "check_C9", text: "Name who reviews the output for C9." },
  13: { link: "check_C10", text: "Assign the data level for C10." },
  18: { link: "sec_4", text: "Record when the system was procured, as Section 4 uses that date." },
  19: { link: "sec_4", text: "Record whether an impact assessment was done before deployment, as Section 4 states." },
};

function plainName(name: string): string {
  if (/^[A-Z][a-z]/.test(name)) return name.charAt(0).toLowerCase() + name.slice(1);
  return name;
}

function actionKind(status: string): "fail" | "partial" | null {
  if (status === "Gap" || status === "Not yet") return "fail";
  if (status === "Partial" || status === "Partly in place") return "partial";
  return null;
}

function isActionCheck(id: string): boolean {
  return /^C(?:[4-9]|1[0-2])$/.test(id) || /^RP\d+$/.test(id);
}

function reason(result: Evaluation): string {
  if (result.prohibited) {
    const use = result.prohibitedLabels[0] ?? "a use on the prohibited list";
    return `The single most important reason is a prohibited use: ${use}.`;
  }
  if (result.statusConflict) {
    return "The single most important reason is that the deployment status and the start date do not agree.";
  }
  const gap = result.criteria.find((item) => item.status === "Gap") ?? result.rp.find((item) => item.status === "Not yet");
  if (gap && isActionCheck(gap.id)) {
    return `The single most important reason is that ${gap.id}, ${plainName(gap.name)}, is not in place.`;
  }
  if (result.priorDeployment) {
    return "The single most important reason is that an impact assessment before deployment is missing or not known.";
  }
  const partial = result.criteria.find((item) => item.status === "Partial") ?? result.rp.find((item) => item.status === "Partly in place");
  if (partial && isActionCheck(partial.id)) {
    return `The single most important reason is that ${partial.id}, ${plainName(partial.name)}, is only partly in place.`;
  }
  if (result.speech) {
    return "The single most important reason is that this use touches speech, assembly or religion and needs named legal authority.";
  }
  const mitigation = result.mitigations.find((item) => item.id !== "M-ONGOING");
  if (mitigation) return `The single most important reason is the open safeguard ${plainName(mitigation.title)}.`;
  return "The single most important reason is that intake found this system High-risk, so yearly monitoring stays in place.";
}

function outcomeSentence(result: Evaluation): string {
  const checks = [...result.criteria, ...result.rp];
  const failed = checks.some((item) => actionKind(item.status) === "fail");
  const partial = checks.some((item) => actionKind(item.status) === "partial");
  const openMitigation = result.mitigations.some((item) => item.id !== "M-ONGOING");
  const highRisk = result.prohibited || failed || result.statusConflict || Boolean(result.priorDeployment);
  const conditions = partial || openMitigation || result.speech || result.crossChecks.length > 0 || !result.attestation || result.followups.length > 0;
  if (highRisk) return "The outcome is high-risk routing.";
  if (conditions) return "The outcome is ready only with conditions.";
  return "The outcome is that the coded safeguards are in place, and this draft does not authorize use.";
}

export function buildBluf(result: Evaluation): BlufCopy {
  const steps: FollowStep[] = [];
  const seen = new Set<string>();
  const add = (text: string, link: string) => {
    const key = `${link}|${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    steps.push({ text, link });
  };
  const linked = (link: string) => steps.some((step) => step.link === link);

  if (result.prohibited) {
    const index = result.mitigations.findIndex((item) => item.id === "M-PROHIBITED");
    if (index >= 0) add("Stop the prohibited use before any use.", `mit_${index + 1}`);
    else add("Stop the prohibited use named in Section 4 before any use.", "sec_4");
  }

  const checks = [...result.criteria, ...result.rp].filter((item) => isActionCheck(item.id));
  for (const kind of ["fail", "partial"] as const) {
    for (const item of checks) {
      if (actionKind(item.status) !== kind) continue;
      const text = kind === "fail"
        ? `Close ${item.id}, ${plainName(item.name)}, which is not in place.`
        : `Finish ${item.id}, ${plainName(item.name)}, which is only partly in place.`;
      add(text, `check_${item.id}`);
    }
  }

  result.mitigations.forEach((mitigation, index) => {
    if (mitigation.id === "M-ONGOING" || mitigation.id === "M-PROHIBITED") return;
    if (mitigation.covers.some((id) => linked(`check_${id}`))) return;
    add(`Complete the safeguard M${index + 1}, ${plainName(mitigation.title)}.`, `mit_${index + 1}`);
  });

  for (const check of result.crossChecks) {
    add(CROSS_STEPS[check.id] ?? `Resolve the ${check.id} note in Section 4.`, "sec_4");
  }
  if (result.priorDeployment) {
    add("Record whether an impact assessment was done before deployment, as Section 4 states.", "sec_4");
  }
  if (result.speech) {
    add("Get named legal authority for this speech, assembly or religion use in Section 4.", "sec_4");
  }
  if (!result.attestation) add("Confirm the attestation and sign Section 9.", "sec_9");

  for (const item of result.followups) {
    const mapped = FOLLOW_STEPS[item.q];
    if (!mapped) continue;
    if (mapped.link.startsWith("check_") && linked(mapped.link)) continue;
    add(mapped.text, mapped.link);
  }

  return {
    sentences: [outcomeSentence(result), "The risk level is High-risk.", reason(result)],
    steps,
  };
}
