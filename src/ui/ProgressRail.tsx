import { useEffect, useRef } from "react";
import { DownloadIcon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { activeSections } from "../content/form";
import type { Answers } from "../engine/answers";
import { deriveAssessmentPath, pathNote } from "../engine/path";
import { missing } from "./app";
import { sectionStepLabel, touchTarget } from "./form-model";
import { reportCanOpen, sectionCanOpen } from "./shell";

export function ProgressRail({
  screen,
  sectionIndex,
  answers,
  maxReached,
  reportUnlocked,
  actionsDisabled,
  exportNote,
  onOpenSection,
  onOpenReport,
  onSave,
  onZip,
}: {
  screen: "home" | "form" | "report";
  sectionIndex: number;
  answers: Answers;
  maxReached: number;
  reportUnlocked: boolean;
  actionsDisabled: boolean;
  exportNote: string;
  onOpenSection: (index: number) => void;
  onOpenReport: () => void;
  onSave: () => void;
  onZip: () => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const navigationEnabled = screen !== "home";
  const reportOpen = screen === "report";
  const sections = activeSections(answers);
  const path = deriveAssessmentPath(answers);
  const done = sections.filter((section) => missing(section, answers).length === 0).length;
  const progressText = reportOpen
    ? `Draft report. ${done} of ${sections.length} sections have no blank required answers. ${pathNote(path.path)}`
    : screen === "form"
      ? `Section ${sectionIndex + 1} of ${sections.length}. ${done} of ${sections.length} sections have no blank required answers. ${pathNote(path.path)}`
      : `${done} of ${sections.length} sections have no blank required answers. ${pathNote(path.path)}`;
  const reportOpenable = reportCanOpen({ navigationEnabled, reportUnlocked });

  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector("[aria-current='step']");
    if (!(current instanceof HTMLElement) || !nav) return;
    const delta = current.getBoundingClientRect().top - nav.getBoundingClientRect().top;
    if (delta < 0 || delta + current.offsetHeight > nav.clientHeight) nav.scrollTop += delta;
  }, [screen, sectionIndex]);

  return (
    <aside
      id="progress-rail"
      aria-label="Assessment progress"
      className="flex h-[70vh] flex-col overflow-hidden border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:sticky lg:top-[var(--sticky-header-height)] lg:h-[calc(100dvh-var(--sticky-header-height))] lg:border-r lg:border-b-0"
    >
      <div className="shrink-0 px-3 py-3">
        <Progress value={done} max={Math.max(sections.length, 1)} aria-label={progressText} aria-valuetext={progressText}>
          <div className="flex w-full items-baseline justify-between gap-2">
            <ProgressLabel className="text-sm font-semibold text-primary">
              {reportOpen ? "Draft report" : screen === "form" ? `Section ${sectionIndex + 1} of ${sections.length}` : "Assessment"}
            </ProgressLabel>
            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{done} of {sections.length} complete</span>
          </div>
        </Progress>
        {screen === "home" ? null : (
          <p id="rail-assessment-path" className="mt-2 text-sm" data-assessment-path={path.path}>{pathNote(path.path)}</p>
        )}
      </div>
      <Separator />
      <p id="sections-label" className="shrink-0 px-3 pt-3 text-sm font-semibold text-primary">Sections</p>
      <nav ref={navRef} aria-labelledby="sections-label" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ol className="flex flex-col gap-1 px-3 py-2" aria-label="Sections">
          {sections.map((section, index) => {
            const current = screen === "form" && index === sectionIndex;
            const complete = missing(section, answers).length === 0;
            const open = sectionCanOpen(index, { maxReached, complete, reportOpen, navigationEnabled });
            return (
              <li key={section.id}>
                <Button
                  type="button"
                  variant={current ? "default" : "outline"}
                  className={`${touchTarget} w-full justify-start px-2.5 text-left whitespace-normal`}
                  aria-current={current ? "step" : undefined}
                  disabled={!open}
                  onClick={() => onOpenSection(index)}
                >
                  <span className="flex w-full items-start justify-between gap-2">
                    <span className="min-w-0 flex-1">{sectionStepLabel(index, section.title)}</span>
                    {complete && !current ? <span className="shrink-0 font-semibold text-success">Done</span> : null}
                  </span>
                  {!open ? <span className="sr-only">Not open yet.</span> : null}
                </Button>
              </li>
            );
          })}
          <li>
            <Button
              type="button"
              variant={reportOpen ? "default" : "outline"}
              className={`${touchTarget} w-full justify-start px-2.5 text-left whitespace-normal`}
              aria-current={reportOpen ? "step" : undefined}
              disabled={!reportOpenable}
              onClick={onOpenReport}
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span>Draft report</span>
              </span>
              {!reportOpenable ? <span className="sr-only">Not open yet.</span> : null}
            </Button>
          </li>
        </ol>
      </nav>
      <Separator />
      <div className="flex shrink-0 flex-col gap-2 p-3">
        <Button id="save-draft" type="button" className={`${touchTarget} w-full whitespace-normal`} disabled={actionsDisabled} onClick={onSave}><SaveIcon data-icon="inline-start" />Save draft</Button>
        <Button id="download-zip" type="button" variant="outline" className={`${touchTarget} w-full whitespace-normal`} disabled={actionsDisabled} onClick={onZip}><DownloadIcon data-icon="inline-start" />Download report package (.zip)</Button>
        <p id="export-status" className="min-h-6 text-sm" aria-live="polite">{exportNote}</p>
      </div>
    </aside>
  );
}
