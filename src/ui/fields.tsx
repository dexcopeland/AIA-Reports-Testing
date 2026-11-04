import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Field as FormField } from "../content/form";
import type { AnswerValue } from "../content/types";
import type { Answers } from "../engine/answers";
import { many, text } from "../engine/answers";

function raw(answers: Answers, key: string): string {
  const value = answers[key];
  return typeof value === "string" ? value : "";
}
import { displayedSamePlace } from "../engine/visibility";
import { DatePicker } from "./DatePicker";
import { GrowingTextarea } from "./GrowingTextarea";
import { HelpTip } from "./HelpTip";
import { relationOptions, roleWarning, statementDefinition, statementInstances, toggleCheck } from "./form-model";

export function FieldControl({
  field,
  answers,
  onAnswer,
}: {
  field: FormField;
  answers: Answers;
  onAnswer: (key: string, value: AnswerValue) => void;
}) {
  if (field.type === "info") {
    return <p className="text-sm text-muted-foreground">{`${field.label}. ${field.help ?? ""}`}</p>;
  }
  if (field.type === "groups") return <GroupsField field={field} answers={answers} onAnswer={onAnswer} />;
  if (field.type === "statement") return <StatementField field={field} answers={answers} onAnswer={onAnswer} />;
  if (field.type === "radio") return <RadioField field={field} answers={answers} onAnswer={onAnswer} />;
  if (field.type === "check") return <CheckField field={field} answers={answers} onAnswer={onAnswer} />;
  if (field.type === "short" || field.type === "email" || field.type === "date" || field.type === "paragraph") {
    return <TextField field={field} answers={answers} onAnswer={onAnswer} />;
  }
  const unexpected: never = field.type;
  return unexpected;
}

function requiredSuffix(field: FormField): string {
  return field.required ? " (required)" : "";
}

function TextField({
  field,
  answers,
  onAnswer,
}: {
  field: FormField;
  answers: Answers;
  onAnswer: (key: string, value: AnswerValue) => void;
}) {
  const helpId = `${field.id}-help`;
  const value = raw(answers, field.id);
  const [warning, setWarning] = useState(() => (field.role ? roleWarning(value) : ""));
  const label = field.label + requiredSuffix(field);
  return (
    <Field>
      <div className="flex items-center gap-1">
        <FieldLabel htmlFor={field.id} className="text-base font-semibold">{label}</FieldLabel>
        {field.help ? <HelpTip label={field.label} text={field.help} /> : null}
      </div>
      {field.help ? <FieldDescription id={helpId}>{field.help}</FieldDescription> : null}
      {field.type === "paragraph" ? (
        <GrowingTextarea
          id={field.id}
          name={field.id}
          value={value}
          aria-describedby={field.help ? helpId : undefined}
          className="min-h-32"
          onChange={(event) => onAnswer(field.id, event.target.value)}
          onBlur={field.role ? (event) => setWarning(roleWarning(event.target.value)) : undefined}
        />
      ) : null}
      {field.type === "date" ? (
        <DatePicker id={field.id} value={value} onChange={(next) => onAnswer(field.id, next)} />
      ) : null}
      {field.type === "short" || field.type === "email" ? (
        <Input
          id={field.id}
          name={field.id}
          type={field.type === "email" ? "email" : "text"}
          value={value}
          autoComplete={field.autocomplete}
          spellCheck={field.spellcheck === false ? false : undefined}
          autoCapitalize={field.spellcheck === false ? "off" : undefined}
          autoCorrect={field.spellcheck === false ? "off" : undefined}
          aria-describedby={field.help ? helpId : undefined}
          onChange={(event) => onAnswer(field.id, event.target.value)}
          onBlur={field.role ? (event) => setWarning(roleWarning(event.target.value)) : undefined}
        />
      ) : null}
      {warning ? (
        <Alert>
          <AlertDescription id={`${field.id}-role`} role="status">{warning}</AlertDescription>
        </Alert>
      ) : null}
    </Field>
  );
}

function RadioField({
  field,
  answers,
  onAnswer,
}: {
  field: FormField;
  answers: Answers;
  onAnswer: (key: string, value: AnswerValue) => void;
}) {
  const helpId = `${field.id}-help`;
  const selected = field.id === "q15_same_place" ? displayedSamePlace(answers) : text(answers, field.id);
  const legend = (field.legend?.(answers) ?? field.label) + requiredSuffix(field);
  return (
    <FieldSet className="gap-2">
      <div className="flex items-center gap-1">
        <FieldLegend className="text-base font-semibold">{legend}</FieldLegend>
        {field.help ? <HelpTip label={field.label} text={field.help} /> : null}
      </div>
      {field.help ? <FieldDescription id={helpId}>{field.help}</FieldDescription> : null}
      <RadioGroup
        name={field.id}
        value={selected}
        aria-describedby={field.help ? helpId : undefined}
        onValueChange={(value) => onAnswer(field.id, value)}
      >
        {(field.options ?? []).map((option) => {
          const id = `${field.id}-${option.id}`;
          return (
            <Field key={option.id} orientation="horizontal" className="items-start">
              <RadioGroupItem id={id} value={option.id} className="mt-1" />
              <FieldLabel htmlFor={id} className="font-normal">{option.label}</FieldLabel>
            </Field>
          );
        })}
      </RadioGroup>
    </FieldSet>
  );
}

function CheckField({
  field,
  answers,
  onAnswer,
}: {
  field: FormField;
  answers: Answers;
  onAnswer: (key: string, value: AnswerValue) => void;
}) {
  const helpId = `${field.id}-help`;
  const picked = many(answers, field.id);
  return (
    <FieldSet className="gap-2">
      <div className="flex items-center gap-1">
        <FieldLegend className="text-base font-semibold">{field.label + requiredSuffix(field)}</FieldLegend>
        {field.help ? <HelpTip label={field.label} text={field.help} /> : null}
      </div>
      {field.help ? <FieldDescription id={helpId}>{field.help}</FieldDescription> : null}
      <FieldGroup className="gap-2" data-slot="checkbox-group">
        {(field.options ?? []).map((option) => {
          const id = `${field.id}-${option.id}`;
          return (
            <Field key={option.id} orientation="horizontal" className="items-start">
              <Checkbox
                id={id}
                name={field.id}
                checked={picked.includes(option.id)}
                aria-describedby={field.help ? helpId : undefined}
                className="mt-1"
                onCheckedChange={(checked) => onAnswer(field.id, toggleCheck(answers, field.id, option.id, checked))}
              />
              <FieldLabel htmlFor={id} className="font-normal">{option.label}</FieldLabel>
            </Field>
          );
        })}
      </FieldGroup>
    </FieldSet>
  );
}

function GroupsField({
  field,
  answers,
  onAnswer,
}: {
  field: FormField;
  answers: Answers;
  onAnswer: (key: string, value: AnswerValue) => void;
}) {
  const helpId = `${field.id}-help`;
  const picked = many(answers, field.id);
  return (
    <FieldSet className="gap-3">
      <div className="flex items-center gap-1">
        <FieldLegend className="text-base font-semibold">{`${field.label} (required)`}</FieldLegend>
        {field.help ? <HelpTip label={field.label} text={field.help} /> : null}
      </div>
      {field.help ? <FieldDescription id={helpId}>{field.help}</FieldDescription> : null}
      {(field.options ?? []).map((option) => {
        const id = `${field.id}-${option.id}`;
        const checked = picked.includes(option.id);
        return (
          <div key={option.id} className="flex flex-col gap-2">
            <Field orientation="horizontal" className="items-start">
              <Checkbox
                id={id}
                name={field.id}
                checked={checked}
                className="mt-1"
                onCheckedChange={(next) => onAnswer(field.id, toggleCheck(answers, field.id, option.id, next))}
              />
              <FieldLabel htmlFor={id} className="font-normal">{option.label}</FieldLabel>
            </Field>
            {checked ? (
              <FieldSet className="ml-6 gap-2 border-l border-border pl-3">
                <FieldLegend className="text-base font-semibold">{`How is ${option.label} affected?`}</FieldLegend>
                <RadioGroup
                  name={`q9_rel__${option.id}`}
                  value={text(answers, `q9_rel__${option.id}`)}
                  onValueChange={(value) => onAnswer(`q9_rel__${option.id}`, value)}
                >
                  {relationOptions().map((relation) => {
                    const relId = `q9_rel__${option.id}-${relation.id}`;
                    return (
                      <Field key={relation.id} orientation="horizontal" className="items-start">
                        <RadioGroupItem id={relId} value={relation.id} className="mt-1" />
                        <FieldLabel htmlFor={relId} className="font-normal">{relation.label}</FieldLabel>
                      </Field>
                    );
                  })}
                </RadioGroup>
              </FieldSet>
            ) : null}
          </div>
        );
      })}
    </FieldSet>
  );
}

function StatementField({
  field,
  answers,
  onAnswer,
}: {
  field: FormField;
  answers: Answers;
  onAnswer: (key: string, value: AnswerValue) => void;
}) {
  const def = statementDefinition(field.statementId);
  if (!def) return null;
  const instances = statementInstances(field, answers);
  return (
    <div className="flex flex-col gap-4">
      {instances.map((instance, index) => {
        const selected = text(answers, instance.key);
        const choice = def.choices.find((item) => item.value === selected);
        const helpId = `${instance.key}-help`;
        const hintId = `${instance.key}-hint`;
        const hint = "Pick the statement closest to today, from weakest to strongest. Planned asks for a date. The strongest line can ask for one line of evidence.";
        return (
          <FieldSet key={instance.key} className="gap-2">
            <div className="flex items-center gap-1">
              <FieldLegend className="text-base font-semibold">{instance.title}</FieldLegend>
              {field.help && index === 0 ? <HelpTip label={instance.title} text={field.help} /> : null}
            </div>
            {field.help && index === 0 ? <FieldDescription id={helpId}>{field.help}</FieldDescription> : null}
            <FieldDescription id={hintId}>{hint}</FieldDescription>
            <RadioGroup
              name={instance.key}
              value={selected}
              aria-describedby={field.help && index === 0 ? `${helpId} ${hintId}` : hintId}
              onValueChange={(value) => onAnswer(instance.key, value)}
            >
              {def.choices.map((item) => {
                const id = `${instance.key}-${item.value}`;
                return (
                  <Field key={item.value} orientation="horizontal" className="items-start">
                    <RadioGroupItem id={id} value={item.value} className="mt-1" />
                    <FieldLabel htmlFor={id} className="font-normal">{item.text}</FieldLabel>
                  </Field>
                );
              })}
            </RadioGroup>
            {choice?.asks === "target_date" ? (
              <Field>
                <FieldLabel htmlFor={`${instance.key}__date`} className="text-base font-semibold">Target date</FieldLabel>
                <DatePicker
                  id={`${instance.key}__date`}
                  value={raw(answers, `${instance.key}__date`)}
                  onChange={(next) => onAnswer(`${instance.key}__date`, next)}
                />
              </Field>
            ) : null}
            {choice?.asks === "evidence" ? (
              <EvidenceLine
                fieldKey={`${instance.key}__evidence`}
                required={Boolean(choice.evidenceRequired)}
                value={raw(answers, `${instance.key}__evidence`)}
                onAnswer={onAnswer}
              />
            ) : null}
          </FieldSet>
        );
      })}
    </div>
  );
}

function EvidenceLine({
  fieldKey,
  required,
  value,
  onAnswer,
}: {
  fieldKey: string;
  required: boolean;
  value: string;
  onAnswer: (key: string, value: AnswerValue) => void;
}) {
  const hintId = `${fieldKey}-hint`;
  const hint = required
    ? "One line: the document, record, contract clause or test result. A blank or token line (such as yes or done) drops this item to Partial."
    : "Optional for this recommended-practice item. A thin line still drops the status.";
  return (
    <Field>
      <div className="flex items-center gap-1">
        <FieldLabel htmlFor={fieldKey} className="text-base font-semibold">Evidence</FieldLabel>
        <HelpTip label="Evidence" text={hint} />
      </div>
      <FieldDescription id={hintId}>{hint}</FieldDescription>
      <Input
        id={fieldKey}
        name={fieldKey}
        value={value}
        aria-describedby={hintId}
        onChange={(event) => onAnswer(fieldKey, event.target.value)}
      />
    </Field>
  );
}
