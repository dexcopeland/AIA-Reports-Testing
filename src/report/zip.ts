import { zipSync } from "fflate";
import { reportToDocxBlob } from "../docx/build-docx";
import { documentView, reportFileStem, type ReportDoc } from "../engine/report";
import { reportToPdfBytes } from "../pdf/build-pdf";
import type { GlyphWarning } from "../pdf/glyphs";

export function uniqueWarnings(warnings: GlyphWarning[]): GlyphWarning[] {
  const map = new Map<string, Set<string>>();
  for (const warning of warnings) {
    const bucket = map.get(warning.character) ?? new Set<string>();
    for (const question of warning.questions) bucket.add(question);
    map.set(warning.character, bucket);
  }
  return [...map].map(([character, questions]) => ({
    character,
    questions: [...questions].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
  }));
}

/** Four PDFs and the same four documents as Word files, zipped in the browser. */
export async function reportPackageZip(doc: ReportDoc): Promise<{ blob: Blob; warnings: GlyphWarning[]; names: string[] }> {
  const stem = reportFileStem(doc.systemName);
  const files: Record<string, Uint8Array> = {};
  const warnings: GlyphWarning[] = [];
  const names: string[] = [];
  for (const part of doc.documents) {
    const view = documentView(doc, part);
    const pdfName = `${stem}-${part.slug}.pdf`;
    const docxName = `${stem}-${part.slug}.docx`;
    const pdf = await reportToPdfBytes(view);
    warnings.push(...pdf.warnings);
    files[pdfName] = pdf.bytes;
    const docx = await reportToDocxBlob(view);
    files[docxName] = new Uint8Array(await docx.arrayBuffer());
    names.push(pdfName, docxName);
  }
  const zipped = zipSync(files, { level: 6 });
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return {
    blob: new Blob([copy], { type: "application/zip" }),
    warnings: uniqueWarnings(warnings),
    names,
  };
}

export function packageZipName(systemName: string): string {
  return `${reportFileStem(systemName)}-report-package.zip`;
}
