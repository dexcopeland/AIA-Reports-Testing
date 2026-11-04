import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
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
import { SECTIONS, visibleFields } from "../content/form";
import type { AnswerFile } from "../content/types";
import { exampleIndex } from "../examples/load";
import { FieldControl } from "./fields";
import { touchTarget } from "./form-model";
import type { AnswerValue } from "../content/types";

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
      <p>Work section by section. You can save a JSON file and load it later on this computer. The draft report is for DoIT AI Governance review.</p>
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
  const section = SECTIONS[sectionIndex];
  if (!section) return null;
  const last = sectionIndex === SECTIONS.length - 1;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <h2 id="section-heading" tabIndex={-1} className="text-2xl font-semibold text-primary outline-none">{section.title}</h2>
          {file.example && file.example_label ? <p>{file.example_label}</p> : null}
        </CardHeader>
        <CardContent>
          <form
            noValidate
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              onNext();
            }}
          >
            {visibleFields(section, file.answers).map((field) => (
              <FieldControl key={field.id} field={field} answers={file.answers} onAnswer={onAnswer} />
            ))}
            {formError ? (
              <Alert id="form-error" variant="destructive">
                <AlertTitle>Still blank</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {sectionIndex > 0 ? (
                <Button type="button" variant="outline" className={touchTarget} onClick={onBack}>Back</Button>
              ) : null}
              <Button type="button" className={touchTarget} onClick={onNext}>{last ? "Review and create draft" : "Save and continue"}</Button>
            </div>
          </form>
          <p id="save-status" className="mt-3 min-h-6" aria-live="polite">{saveNote}</p>
        </CardContent>
      </Card>
    </div>
  );
}
