import { many, text } from "../engine/answers";
import { buildReport } from "../engine/report";
import type { AnswerFile } from "../content/types";

export function reportDownloadBlocked(file: AnswerFile): boolean {
  return !(text(file.answers, "q25_confirm") === "confirm" || many(file.answers, "q25_confirm").includes("confirm"));
}

export async function downloadReportPackage(file: AnswerFile): Promise<string> {
  if (reportDownloadBlocked(file)) {
    return "Confirm Q25 before you download the report package. This block is a proposed rule. The on-screen draft is still available.";
  }
  try {
    // Loaded on demand so the Word, PDF, and zip libraries stay out of the first paint.
    const [{ downloadBlob }, zip] = await Promise.all([
      import("../docx/build-docx"),
      import("../report/zip"),
    ]);
    const current = buildReport(file);
    const { blob, warnings } = await zip.reportPackageZip(current);
    downloadBlob(blob, zip.packageZipName(current.systemName));
    if (warnings.length === 0) {
      return "Report package downloaded. It contains four PDFs and the same four documents as Word files.";
    }
    const listed = warnings.map((warning) => `${warning.character} (${warning.questions.join(", ")})`).join("; ");
    return `Report package downloaded. These characters are not in the report fonts, so they may not appear: ${listed}.`;
  } catch {
    return "The report package could not be built in this browser.";
  }
}
