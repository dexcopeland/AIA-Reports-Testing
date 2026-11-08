import type { AnswerFile, MitigationAck, ReportSignoff } from "../content/types";

export function emptySignoff(): ReportSignoff {
  return { mitigations: [], lead_name: "", lead_title: "", lead_date: "" };
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeSignoff(value: unknown): ReportSignoff | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Partial<ReportSignoff>;
  const mitigations = Array.isArray(record.mitigations)
    ? record.mitigations.flatMap((item): MitigationAck[] => {
        if (!item || typeof item !== "object") return [];
        const row = item as Partial<MitigationAck>;
        const id = textOf(row.id).trim();
        if (!id) return [];
        const choice = row.choice === "yes" || row.choice === "no" ? row.choice : "";
        return [{ id, choice, date: textOf(row.date), comment: textOf(row.comment) }];
      })
    : [];
  return {
    mitigations,
    lead_name: textOf(record.lead_name),
    lead_title: textOf(record.lead_title),
    lead_date: textOf(record.lead_date),
  };
}

export function ensureSignoff(file: AnswerFile): ReportSignoff {
  if (!file.signoff) file.signoff = emptySignoff();
  return file.signoff;
}

export function ackFor(file: AnswerFile, id: string): MitigationAck | undefined {
  return file.signoff?.mitigations.find((item) => item.id === id);
}

export function upsertAck(file: AnswerFile, id: string): MitigationAck {
  const signoff = ensureSignoff(file);
  const existing = signoff.mitigations.find((item) => item.id === id);
  if (existing) return existing;
  const created: MitigationAck = { id, choice: "", date: "", comment: "" };
  signoff.mitigations.push(created);
  return created;
}
