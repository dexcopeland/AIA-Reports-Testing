import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { activeSections, sectionHeading, visibleFields, type Field as FormField } from "../content/form";
import { FIXED } from "../content/rules";
import { deriveAssessmentPath, pathNote } from "../engine/path";
import type { AnswerFile, AnswerValue } from "../content/types";
import type { Answers } from "../engine/answers";
import { exampleIndex } from "../examples/load";
import { FieldControl } from "./fields";
import { touchTarget } from "./form-model";
import { clusterUsesColumns, questionClusters } from "./shell";

const exampleItems = [
  { value: null, label: "Choose an example" },
  ...exampleIndex.groups.flatMap((group) => group.examples.map((item) => ({ value: item.id, label: item.title }))),
];

export function HomeScreen({
  saved,
  onStart,
  onContinue,
  onLoadExample,
  onLoadFile,
  loadMessage,
}: {
  saved: AnswerFile | null;
  onStart: () => void;
  onContinue: () => void;
  onLoadExample: (id: string) => void;
  onLoadFile: (file: File) => void;
  loadMessage: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const entry = exampleIndex.groups.flatMap((group) => group.examples).find((item) => item.id === selectedId);
  return (
    <div className="flex flex-col gap-4">
      <h2 id="section-heading" tabIndex={-1} className="text-2xl font-semibold text-primary outline-none">Start an assessment</h2>
      <p>Work section by section. You can save a JSON file and load it later on this computer. {FIXED.draftBanner}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className={touchTarget} onClick={onStart}>Start a new assessment</Button>
        {saved && Object.keys(saved.answers).length > 0 ? (
          <Button type="button" variant="outline" className={touchTarget} onClick={onContinue}>Continue saved draft</Button>
        ) : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <label htmlFor="example-select">Load an example</label>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Select
            items={exampleItems}
            value={selectedId}
            onValueChange={(value) => setSelectedId(typeof value === "string" ? value : null)}
          >
            <SelectTrigger id="example-select" aria-describedby="example-description">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false}>
              {exampleIndex.groups.map((group) => (
                <SelectGroup key={group.id}>
                  <SelectLabel className="text-sm font-semibold text-primary">{group.label}</SelectLabel>
                  {group.examples.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <span className="flex flex-col items-start gap-0.5">
                        <span className="font-semibold">{item.title}</span>
                        <span className="example-desc text-sm font-normal">{item.description}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <p id="example-description" className="text-sm text-muted-foreground" aria-live="polite">{entry?.description ?? ""}</p>
          <Button
            id="load-example"
            type="button"
            className={touchTarget}
            disabled={!entry}
            onClick={() => {
              if (entry) onLoadExample(entry.id);
            }}
          >
            Load this example
          </Button>
        </CardContent>
      </Card>
      <LoadFileCard onLoadFile={onLoadFile} message={loadMessage} />
    </div>
  );
}

export function LoadFileCard({ onLoadFile, message }: { onLoadFile: (file: File) => void; message: string }) {
  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle>Load a saved file</CardTitle>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor="load-file">Answers JSON file</FieldLabel>
          <Input
            id="load-file"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              if (!picked) return;
              onLoadFile(picked);
            }}
          />
          <p aria-live="polite">{message}</p>
        </Field>
      </CardContent>
    </Card>
  );
}

function QuestionCard({
  fields,
  answers,
  onAnswer,
}: {
  fields: FormField[];
  answers: Answers;
  onAnswer: (key: string, value: AnswerValue) => void;
}) {
  const question = fields[0]?.legacyQ;
  const columns = clusterUsesColumns(fields);
  return (
    <Card data-question={question}>
      <CardHeader className="border-b">
        <CardTitle>Question {question}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={columns ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "flex flex-col gap-4"}>
          {fields.map((field) => (
            <FieldControl key={field.id} field={field} answers={answers} onAnswer={onAnswer} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function FormScreen({
  file,
  sectionIndex,
  formError,
  saveNote,
  onAnswer,
  onBack,
  onNext,
}: {
  file: AnswerFile;
  sectionIndex: number;
  formError: string;
  saveNote: string;
  onAnswer: (key: string, value: AnswerValue) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const sections = activeSections(file.answers);
  const section = sections[sectionIndex];
  if (!section) return null;
  const last = sectionIndex === sections.length - 1;
  const clusters = questionClusters(visibleFields(section, file.answers));
  const path = deriveAssessmentPath(file.answers);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p id="assessment-path" className="text-sm font-semibold text-primary" data-assessment-path={path.path}>{pathNote(path.path)}</p>
        <p className="text-sm font-semibold text-primary">Section {sectionIndex + 1} of {sections.length}</p>
        <h2 id="section-heading" tabIndex={-1} className="text-2xl font-semibold text-primary outline-none">{sectionHeading(sectionIndex, section.title)}</h2>
        {file.example && file.example_label ? <p>{file.example_label}</p> : null}
      </div>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onNext();
        }}
      >
        <div className="flex flex-col gap-4">
          {clusters.map((cluster) => (
            <QuestionCard key={cluster[0]?.id ?? "question"} fields={cluster} answers={file.answers} onAnswer={onAnswer} />
          ))}
        </div>
        {formError ? (
          <Alert id="form-error" variant="destructive">
            <AlertTitle>Still blank</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <Separator />
        <div className="flex flex-wrap gap-2">
          {sectionIndex > 0 ? (
            <Button type="button" variant="outline" className={touchTarget} onClick={onBack}>Back</Button>
          ) : null}
          <Button type="button" className={touchTarget} onClick={onNext}>{last ? "Review and create draft" : "Save and continue"}</Button>
        </div>
      </form>
      <p id="save-status" className="min-h-6" aria-live="polite">{saveNote}</p>
    </div>
  );
}
