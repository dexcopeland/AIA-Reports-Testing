import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SECTIONS } from "../content/form";
import type { AnswerFile } from "../content/types";
import { many, text } from "../engine/answers";
import { buildReport } from "../engine/report";
import { missing } from "./app";
import { touchTarget } from "./form-model";
import { ReportArticle, type SignoffEdit } from "./ReportArticle";

function attested(file: AnswerFile): boolean {
  return text(file.answers, "q25_confirm") === "confirm" || many(file.answers, "q25_confirm").includes("confirm");
}

export function ReportScreen({
  file,
  onBack,
  onEdit,
}: {
  file: AnswerFile;
  onBack: () => void;
  onEdit: SignoffEdit;
}) {
  const doc = useMemo(() => buildReport(file), [file]);
  const blanks = SECTIONS.flatMap((section) => missing(section, file.answers));
  const blocked = !attested(file);
  const [exportNote, setExportNote] = useState("");

  async function downloadPackage(): Promise<void> {
    if (!attested(file)) {
      setExportNote("Confirm Q25 before you download the report package. This block is a proposed rule. The on-screen draft is still available.");
      return;
    }
    try {
      const [{ downloadBlob }, zip] = await Promise.all([
        import("../docx/build-docx"),
        import("../report/zip"),
      ]);
      const current = buildReport(file);
      const { blob, warnings } = await zip.reportPackageZip(current);
      downloadBlob(blob, zip.packageZipName(current.systemName));
      if (warnings.length === 0) {
        setExportNote("Report package downloaded. It contains four PDFs and the same four documents as Word files.");
        return;
      }
      const listed = warnings.map((warning) => `${warning.character} (${warning.questions.join(", ")})`).join("; ");
      setExportNote(`Report package downloaded. These characters are not in the report fonts, so they may not appear: ${listed}.`);
    } catch {
      setExportNote("The report package could not be built in this browser.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 id="section-heading" tabIndex={-1} className="no-print text-2xl font-semibold text-primary outline-none">Draft report</h2>
      {file.example_label ? <p className="no-print">{file.example_label}</p> : null}
      {blanks.length > 0 ? (
        <Alert variant="destructive" className="no-print">
          <AlertDescription>{`Some required answers are blank (${blanks.length}). Blank answers are treated as gaps or as not yet in place.`}</AlertDescription>
        </Alert>
      ) : null}
      <div className="no-print flex flex-wrap gap-2">
        <Button type="button" variant="outline" className={touchTarget} onClick={onBack}>Back to answers</Button>
        <Button type="button" variant="outline" className={touchTarget} onClick={() => void downloadPackage()}>
          Download report package (.zip)
        </Button>
      </div>
      {blocked ? <p className="no-print">The report package stays off until Q25 is confirmed.</p> : null}
      <p className="status min-h-6" aria-live="polite">{exportNote}</p>
      <p className="no-print">Fill the dates, comments, and Agency Lead name in the executive summary before you download. They are saved in this draft. The signature stays blank for a handwritten or PDF signature.</p>
      <details className="no-print">
        <summary>Draft checks</summary>
        <ul className="check-list">
          {doc.checks.map((check) => (
            <li key={check.id} className={check.ok ? undefined : "bad"}>
              {`${check.ok ? "Pass" : "Check"}: ${check.id}. ${check.detail}`}
            </li>
          ))}
        </ul>
      </details>
      <ReportArticle doc={doc} onEdit={onEdit} />
    </div>
  );
}
