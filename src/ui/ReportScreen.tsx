import { useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SECTIONS } from "../content/form";
import type { AnswerFile } from "../content/types";
import { buildReport } from "../engine/report";
import { missing } from "./app";
import { touchTarget } from "./form-model";
import { ReportArticle, type SignoffEdit } from "./ReportArticle";
import { reportDownloadBlocked } from "./report-package";

export function ReportScreen({
  file,
  exportNote,
  onBack,
  onEdit,
}: {
  file: AnswerFile;
  exportNote: string;
  onBack: () => void;
  onEdit: SignoffEdit;
}) {
  const doc = useMemo(() => buildReport(file), [file]);
  const blanks = SECTIONS.flatMap((section) => missing(section, file.answers));
  const blocked = reportDownloadBlocked(file);

  return (
    <div className="flex flex-col gap-4">
      <h2
        id="section-heading"
        tabIndex={-1}
        className="no-print text-2xl font-semibold text-primary outline-none"
      >
        Draft report
      </h2>
      {file.example_label ? <p className="no-print">{file.example_label}</p> : null}
      {blanks.length > 0 ? (
        <Alert variant="destructive" className="no-print">
          <AlertDescription>{`Some required answers are blank (${blanks.length}). Blank answers are treated as gaps or as not yet in place.`}</AlertDescription>
        </Alert>
      ) : null}
      <div className="no-print flex flex-wrap gap-2">
        <Button type="button" variant="outline" className={touchTarget} onClick={onBack}>
          Back to answers
        </Button>
      </div>
      {blocked ? (
        <p className="no-print">The report package stays off until Q25 is confirmed.</p>
      ) : null}
      <p className="status min-h-6">{exportNote}</p>
      <p className="no-print">
        Fill the dates, comments, and Agency Lead name in the executive summary before you download.
        They are saved in this draft. The signature stays blank for a handwritten or PDF signature.
      </p>
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
