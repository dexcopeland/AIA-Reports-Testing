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
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { SECTIONS } from "../content/form";
import { FORM_VERSION, RULES_VERSION, SCHEMA_VERSION, type AnswerFile, type AnswerValue } from "../content/types";
import { exampleIndex, loadExampleFile } from "../examples/load";
import { ensureSignoff, upsertAck } from "../engine/signoff";
import { missing } from "./app";
import { sectionStepLabel, touchTarget } from "./form-model";
import { ReportScreen } from "./ReportScreen";
import { FormScreen, HomeScreen, LoadFileCard } from "./screens";
import { autosave, autoload, clearAutosave, downloadJson, emptyFile, normalizeFile } from "./storage";

type Screen = "home" | "form" | "report";

function stamp(file: AnswerFile): AnswerFile {
  return {
    ...file,
    saved_at: new Date().toISOString(),
    rules_version: RULES_VERSION,
    form_version: FORM_VERSION,
    schema_version: SCHEMA_VERSION,
  };
}

export function AssessmentApp() {
  const [file, setFile] = useState<AnswerFile>(() => autoload() ?? emptyFile());
  const [screen, setScreen] = useState<Screen>("home");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [saveNote, setSaveNote] = useState("Nothing is stored on a server.");
  const [headerNote, setHeaderNote] = useState("");
  const [formError, setFormError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [loadMessage, setLoadMessage] = useState("");
  const [focusNonce, setFocusNonce] = useState(0);
  const fileRef = useRef(file);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (focusNonce === 0) return;
    document.getElementById("section-heading")?.focus();
  }, [focusNonce]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const sync = () => {
      document.documentElement.style.setProperty("--sticky-header-height", `${header.offsetHeight}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => observer.disconnect();
  }, [screen, sectionIndex]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const nav = navRef.current;
      const current = nav?.querySelector("[aria-current='step']");
      if (!(current instanceof HTMLElement) || !nav) return;
      const delta = current.getBoundingClientRect().left - nav.getBoundingClientRect().left;
      nav.scrollLeft += delta - 8;
    });
    return () => cancelAnimationFrame(frame);
  }, [screen, sectionIndex]);

  function commit(next: AnswerFile, note = "Saved in this browser."): AnswerFile {
    const stamped = stamp(next);
    fileRef.current = stamped;
    autosave(stamped);
    setFile(stamped);
    setSaveNote(note);
    return stamped;
  }

  function focusNext(): void {
    setFocusNonce((value) => value + 1);
  }

  function setAnswer(key: string, value: AnswerValue): void {
    const current = fileRef.current;
    setDirty(true);
    commit({
      ...current,
      example: false,
      answers: { ...current.answers, [key]: value },
    });
  }

  function editSignoff(signId: string, fieldName: string, value: string): void {
    const next = structuredClone(fileRef.current);
    if (signId === "lead") {
      const signoff = ensureSignoff(next);
      if (fieldName === "lead_name") signoff.lead_name = value;
      else if (fieldName === "lead_title") signoff.lead_title = value;
      else if (fieldName === "lead_date") signoff.lead_date = value;
    } else if (signId) {
      const ack = upsertAck(next, signId);
      if (fieldName.startsWith("ack_")) ack.choice = value === "no" ? "no" : "yes";
      else if (fieldName.startsWith("date_")) ack.date = value;
      else if (fieldName.startsWith("comment_")) ack.comment = value;
    }
    commit(next);
  }

  function openSection(index: number): void {
    setSectionIndex(index);
    setFormError("");
    setScreen("form");
    focusNext();
  }

  function goNext(): void {
    const blanks = missing(SECTIONS[sectionIndex]!, fileRef.current.answers);
    if (blanks.length > 0 && sectionIndex < SECTIONS.length - 1) {
      const message = `Still blank: ${blanks.join("; ")}. You can continue. A blank answer counts as a gap.`;
      if (!formError) {
        setFormError(message);
        return;
      }
    }
    setFormError("");
    if (sectionIndex < SECTIONS.length - 1) {
      setSectionIndex(sectionIndex + 1);
      focusNext();
      return;
    }
    setScreen("report");
    focusNext();
  }

  function startNew(): void {
    clearAutosave();
    const next = emptyFile();
    fileRef.current = next;
    setFile(next);
    setDirty(false);
    setSectionIndex(0);
    setFormError("");
    setSaveNote("Nothing is stored on a server.");
    setScreen("form");
    focusNext();
  }

  function continueDraft(): void {
    const saved = autoload();
    if (!saved || Object.keys(saved.answers).length === 0) return;
    fileRef.current = saved;
    setFile(saved);
    setDirty(false);
    setSectionIndex(0);
    setFormError("");
    setScreen("form");
    focusNext();
  }

  function loadExample(id: string): void {
    const entry = exampleIndexEntry(id);
    if (!entry) return;
    commit(loadExampleFile(entry.file), "Example loaded. Saved in this browser.");
    setDirty(false);
    setSectionIndex(0);
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

  const saved = autoload();
  const noAnswers = Object.keys(file.answers).length === 0;
  const done = SECTIONS.filter((item) => missing(item, file.answers).length === 0).length;
  const shown = screen === "report" ? SECTIONS.length : sectionIndex + 1;
  const progressText = screen === "report"
    ? `Draft report. ${done} sections have no blank required answers.`
    : `Section ${sectionIndex + 1} of ${SECTIONS.length}. ${done} sections have no blank required answers.`;

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header id="site-header" ref={headerRef} className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-[0_1px_0_rgb(0_0_0/0.28)]">
        <div className="mx-auto flex max-w-[52rem] flex-wrap items-start justify-between gap-x-5 gap-y-3 px-4 py-3 max-[42rem]:flex-col">
          <div className="min-w-[min(100%,18rem)] flex-1">
            <h1 className="text-[1.6rem] leading-tight font-bold max-[42rem]:text-lg">Algorithmic Impact Assessment</h1>
            <p className="mt-1 max-w-2xl max-[42rem]:hidden">A draft for Maryland agencies. You answer in this browser. The report is built with fixed rules. Nothing is sent to a server.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 max-[42rem]:w-full">
            <Button id="go-home" type="button" variant="secondary" className={`${touchTarget} max-[42rem]:flex-1`} disabled={screen === "home"} onClick={requestHome}>Home</Button>
            <Button id="save-draft" type="button" variant="secondary" className={`${touchTarget} max-[42rem]:flex-1`} disabled={noAnswers} onClick={saveDraft}>Save draft</Button>
            <p id="header-save-status" className="sr-only" aria-live="polite">{headerNote}</p>
          </div>
        </div>
        <div id="header-progress" className="border-b border-border bg-card text-foreground" hidden={screen === "home"}>
          {screen === "home" ? null : (
            <div className="mx-auto flex max-w-[52rem] flex-col gap-2 px-4 py-2">
              <Progress value={shown} max={SECTIONS.length} aria-valuetext={progressText} aria-label={progressText}>
                <ProgressLabel className="sr-only">{progressText}</ProgressLabel>
              </Progress>
              <ol ref={navRef} className="flex gap-1 overflow-x-auto" aria-label="Sections">
                {SECTIONS.map((item, index) => {
                  const current = screen === "form" && index === sectionIndex;
                  return (
                    <li key={item.id} className="shrink-0">
                      <Button
                        type="button"
                        variant={current ? "default" : "outline"}
                        className="min-h-11 px-2 text-sm whitespace-nowrap"
                        aria-current={current ? "step" : undefined}
                        onClick={() => openSection(index)}
                      >
                        {sectionStepLabel(index, item.title)}
                      </Button>
                    </li>
                  );
                })}
                {screen === "report" ? (
                  <li className="shrink-0">
                    <Button type="button" className="min-h-11 px-2 text-sm whitespace-nowrap" aria-current="step">Report</Button>
                  </li>
                ) : null}
              </ol>
            </div>
          )}
        </div>
      </header>
      <div className="banner border-b border-banner-border bg-banner text-banner-foreground">
        <div className="mx-auto max-w-[52rem] px-4 py-2.5">Draft for DoIT AI Governance review. This tool does not approve an AI system.</div>
      </div>
      <main id="main" className="mx-auto max-w-[52rem] px-4 pt-4 pb-12">
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
            <div className="mt-4">
              <LoadFileCard onLoadFile={readFile} message={loadMessage} />
            </div>
          </>
        ) : null}
        {screen === "report" ? (
          <ReportScreen file={file} onBack={() => openSection(sectionIndex)} onEdit={editSignoff} />
        ) : null}
      </main>
      <Dialog open={leaveOpen} onOpenChange={(open) => { if (!open) setLeaveOpen(false); }}>
        <DialogContent id="leave-dialog" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Save a draft before going home?</DialogTitle>
            <DialogDescription>This assessment has changes since the last saved draft. You can download the draft first. The copy in this browser stays either way.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col sm:items-stretch">
            <Button type="button" className={touchTarget} onClick={() => { saveDraft(); finishHome("Draft file downloaded."); }}>Save draft</Button>
            <Button type="button" variant="outline" className={touchTarget} onClick={() => finishHome()}>Leave without saving</Button>
            <Button type="button" variant="outline" className={touchTarget} autoFocus onClick={() => setLeaveOpen(false)}>Stay</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function exampleIndexEntry(id: string) {
  return exampleIndex.groups.flatMap((group) => group.examples).find((item) => item.id === id);
}
