import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { activeSections } from "../content/form";
import { FIXED } from "../content/rules";
import { type AnswerFile, type AnswerValue } from "../content/types";
import { exampleIndex, loadExampleFile } from "../examples/load";
import { emptySignoff, ensureSignoff, upsertAck } from "../engine/signoff";
import { missing } from "./app";
import { touchTarget } from "./form-model";
import { ProgressRail } from "./ProgressRail";
import { downloadReportPackage } from "./report-package";
import { ReportScreen } from "./ReportScreen";
import { FormScreen, HomeScreen, LoadFileCard } from "./screens";
import { initialMaxReached, persistAdvance, reachedAfterOpen } from "./shell";
import {
  autosave,
  autoload,
  clearAutosave,
  downloadJson,
  emptyFile,
  normalizeFile,
} from "./storage";

type Screen = "home" | "form" | "report";

const SAVE_FAILED = "This browser did not keep that draft. Use Save JSON file to keep it.";

function reachedFor(file: AnswerFile): number {
  return initialMaxReached(
    activeSections(file.answers).map((section) => missing(section, file.answers).length),
  );
}

export function AssessmentApp() {
  const [file, setFile] = useState<AnswerFile>(() => autoload() ?? emptyFile());
  // The browser's copy, as of the last write that succeeded. Read once, then
  // updated wherever the browser's copy is replaced or cleared.
  const [saved, setSaved] = useState<AnswerFile | null>(() => autoload());
  const [screen, setScreen] = useState<Screen>("home");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [saveNote, setSaveNote] = useState("Nothing is stored on a server.");
  const [headerNote, setHeaderNote] = useState("");
  const [formError, setFormError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [loadMessage, setLoadMessage] = useState("");
  const [focusNonce, setFocusNonce] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [reportUnlocked, setReportUnlocked] = useState(false);
  const [exportNote, setExportNote] = useState("");
  const fileRef = useRef(file);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (focusNonce === 0) return;
    document.getElementById("section-heading")?.focus();
  }, [focusNonce]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const sync = () => {
      document.documentElement.style.setProperty(
        "--sticky-header-height",
        `${header.offsetHeight}px`,
      );
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => observer.disconnect();
  }, [screen, sectionIndex]);

  function commit(next: AnswerFile, note = "Saved in this browser."): AnswerFile {
    const { file: stamped, persisted } = persistAdvance(next, autosave);
    fileRef.current = stamped;
    setFile(stamped);
    setSaveNote(persisted ? note : SAVE_FAILED);
    if (!persisted) setHeaderNote(SAVE_FAILED);
    if (persisted) setSaved(stamped);
    return stamped;
  }

  function focusNext(): void {
    setFocusNonce((value) => value + 1);
  }

  function setAnswer(key: string, value: AnswerValue): void {
    const current = fileRef.current;
    setDirty(true);
    const next: AnswerFile = {
      ...current,
      example: false,
      answers: { ...current.answers, [key]: value },
    };
    if ((key === "q3_lead_name" || key === "q3_lead_role") && typeof value === "string") {
      const signoff = structuredClone(current.signoff ?? emptySignoff());
      if (key === "q3_lead_name") signoff.lead_name = value;
      else signoff.lead_title = value;
      next.signoff = signoff;
    }
    commit(next);
  }

  function editSignoff(signId: string, fieldName: string, value: string): void {
    const next = structuredClone(fileRef.current);
    if (signId === "lead") {
      const signoff = ensureSignoff(next);
      if (fieldName === "lead_name") {
        signoff.lead_name = value;
        next.answers.q3_lead_name = value;
      } else if (fieldName === "lead_title") {
        signoff.lead_title = value;
        next.answers.q3_lead_role = value;
      } else if (fieldName === "lead_email") {
        next.answers.q3_email = value;
      } else if (fieldName === "lead_date") signoff.lead_date = value;
    } else if (signId) {
      const ack = upsertAck(next, signId);
      if (fieldName.startsWith("ack_")) ack.choice = value === "no" ? "no" : "yes";
      else if (fieldName.startsWith("date_")) ack.date = value;
      else if (fieldName.startsWith("comment_")) ack.comment = value;
    }
    commit(next);
  }

  function openSection(index: number): void {
    const sections = activeSections(fileRef.current.answers);
    if (index < 0 || index >= sections.length) return;
    commit(fileRef.current, "Saved in this browser.");
    setSectionIndex(index);
    setMaxReached((current) => reachedAfterOpen(current, index));
    setFormError("");
    setScreen("form");
    focusNext();
  }

  function showReport(): void {
    if (!reportUnlocked) return;
    commit(fileRef.current, "Saved in this browser.");
    setFormError("");
    setScreen("report");
    focusNext();
  }

  function goNext(): void {
    commit(fileRef.current, "Saved in this browser.");
    const sections = activeSections(fileRef.current.answers);
    const section = sections[sectionIndex];
    const blanks = section ? missing(section, fileRef.current.answers) : [];
    if (blanks.length > 0 && sectionIndex < sections.length - 1) {
      const message = `Still blank: ${blanks.join("; ")}. You can continue. A blank answer counts as a gap.`;
      if (!formError) {
        setFormError(message);
        return;
      }
    }
    setFormError("");
    if (sectionIndex < sections.length - 1) {
      const nextIndex = sectionIndex + 1;
      setSectionIndex(nextIndex);
      setMaxReached((current) => reachedAfterOpen(current, nextIndex));
      focusNext();
      return;
    }
    setReportUnlocked(true);
    setScreen("report");
    focusNext();
  }

  function startNew(): void {
    clearAutosave();
    setSaved(null);
    const next = emptyFile();
    fileRef.current = next;
    setFile(next);
    setDirty(false);
    setSectionIndex(0);
    setMaxReached(0);
    setReportUnlocked(false);
    setExportNote("");
    setFormError("");
    setSaveNote("Nothing is stored on a server.");
    setScreen("form");
    focusNext();
  }

  function continueDraft(): void {
    const restored = autoload();
    if (!restored || Object.keys(restored.answers).length === 0) return;
    fileRef.current = restored;
    setFile(restored);
    setSaved(restored);
    setDirty(false);
    setSectionIndex(0);
    setMaxReached(reachedFor(restored));
    setReportUnlocked(false);
    setExportNote("");
    setFormError("");
    setScreen("form");
    focusNext();
  }

  function loadExample(id: string): void {
    const entry = exampleIndexEntry(id);
    if (!entry) return;
    const next = loadExampleFile(entry.file);
    commit(next, "Example loaded. Saved in this browser.");
    setDirty(false);
    setSectionIndex(0);
    setMaxReached(reachedFor(next));
    setReportUnlocked(false);
    setExportNote("");
    setFormError("");
    setScreen("form");
    focusNext();
  }

  function readFile(picked: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = normalizeFile(JSON.parse(String(reader.result)));
        commit(next);
        setDirty(false);
        setSectionIndex(0);
        setMaxReached(reachedFor(next));
        setReportUnlocked(false);
        setExportNote("");
        setLoadMessage("File loaded.");
        setScreen("form");
        focusNext();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not read that file.";
        setLoadMessage(message);
        setHeaderNote(message);
      }
    };
    reader.readAsText(picked);
  }

  function saveDraft(): void {
    const stamped = commit(fileRef.current, "Draft file downloaded.");
    downloadJson(stamped);
    setDirty(false);
    setHeaderNote("Draft file downloaded.");
  }

  async function downloadPackage(): Promise<void> {
    const note = await downloadReportPackage(fileRef.current);
    setExportNote(note);
  }

  function finishHome(message?: string): void {
    setScreen("home");
    setFormError("");
    if (message) setHeaderNote(message);
    setLeaveOpen(false);
    focusNext();
  }

  function requestHome(): void {
    if (screen !== "home" && dirty) {
      setLeaveOpen(true);
      return;
    }
    finishHome();
  }

  const noAnswers = Object.keys(file.answers).length === 0;

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header
        id="site-header"
        ref={headerRef}
        className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-[0_1px_0_rgb(0_0_0/0.28)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 lg:px-6">
          <div className="min-w-[min(100%,16rem)] flex-1">
            <h1 className="text-xl leading-tight font-bold sm:text-[1.65rem]">
              Algorithmic Impact Assessment
            </h1>
            <p className="mt-1 hidden max-w-3xl text-sm leading-snug min-[42rem]:block">
              A draft for Maryland agencies. You answer in this browser. The report is built with
              fixed rules. Nothing is sent to a server.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 max-[42rem]:w-full">
            <Button
              id="go-home"
              type="button"
              variant="secondary"
              className={`${touchTarget} max-[42rem]:w-full`}
              disabled={screen === "home"}
              onClick={requestHome}
            >
              Home
            </Button>
            <p id="header-save-status" className="sr-only" aria-live="polite">
              {headerNote}
            </p>
          </div>
        </div>
        <div className="banner border-t border-primary-foreground/20 bg-banner px-4 py-2 text-sm text-banner-foreground lg:px-6">
          {FIXED.draftBanner}
        </div>
      </header>
      <div id="app-shell" className="grid items-start lg:grid-cols-[18.5rem_minmax(0,1fr)]">
        <ProgressRail
          screen={screen}
          sectionIndex={sectionIndex}
          answers={file.answers}
          maxReached={maxReached}
          reportUnlocked={reportUnlocked}
          actionsDisabled={noAnswers}
          exportNote={exportNote}
          onOpenSection={openSection}
          onOpenReport={showReport}
          onSave={saveDraft}
          onZip={() => void downloadPackage()}
        />
        <main id="main" tabIndex={-1} className="min-w-0 px-4 py-5 pb-14 lg:px-8 outline-none">
          <div id="assessment-column" className="mx-auto flex w-full max-w-[76rem] flex-col gap-4">
            {screen === "home" ? (
              <HomeScreen
                saved={saved}
                onStart={startNew}
                onContinue={continueDraft}
                onLoadExample={loadExample}
                onLoadFile={readFile}
                loadMessage={loadMessage}
              />
            ) : null}
            {screen === "form" ? (
              <>
                <FormScreen
                  file={file}
                  sectionIndex={sectionIndex}
                  formError={formError}
                  saveNote={saveNote}
                  onAnswer={setAnswer}
                  onBack={() => openSection(sectionIndex - 1)}
                  onNext={goNext}
                />
                <LoadFileCard onLoadFile={readFile} message={loadMessage} />
              </>
            ) : null}
            {screen === "report" ? (
              <ReportScreen
                file={file}
                exportNote={exportNote}
                onBack={() => openSection(sectionIndex)}
                onEdit={editSignoff}
              />
            ) : null}
          </div>
        </main>
      </div>
      <Dialog
        open={leaveOpen}
        onOpenChange={(open) => {
          if (!open) setLeaveOpen(false);
        }}
      >
        <DialogContent id="leave-dialog" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Save a draft before going home?</DialogTitle>
            <DialogDescription>
              This assessment has changes since the last saved draft. You can download the draft
              first. The copy in this browser stays either way.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col sm:items-stretch">
            <Button
              type="button"
              className={touchTarget}
              onClick={() => {
                saveDraft();
                finishHome("Draft file downloaded.");
              }}
            >
              Save draft
            </Button>
            <Button
              type="button"
              variant="outline"
              className={touchTarget}
              onClick={() => finishHome()}
            >
              Leave without saving
            </Button>
            <Button
              type="button"
              variant="outline"
              className={touchTarget}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- modal opens on intent: focus lands on the least destructive action, "Stay".
              autoFocus
              onClick={() => setLeaveOpen(false)}
            >
              Stay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function exampleIndexEntry(id: string) {
  return exampleIndex.groups.flatMap((group) => group.examples).find((item) => item.id === id);
}
