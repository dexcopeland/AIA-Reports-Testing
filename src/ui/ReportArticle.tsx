import type { ReactNode } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Block, ReportDoc, SignField } from "../engine/report";
import { DatePicker } from "./DatePicker";
import { GrowingTextarea } from "./GrowingTextarea";

export type SignoffEdit = (signId: string, fieldName: string, value: string) => void;

function choiceValue(field: SignField): string {
  return field.label === "No" ? "no" : "yes";
}

function fieldLabel(field: SignField): string {
  if (field.kind === "text" && field.label.startsWith("Title")) return "Title";
  return field.label;
}

function SignatureSpace() {
  return <div className="sign-write sign-signature" aria-hidden="true" />;
}

function SignControl({
  field,
  signId,
  onEdit,
}: {
  field: SignField;
  signId: string;
  onEdit: SignoffEdit;
}) {
  const id = `sign-${field.name}`;
  if (field.kind === "signature") return <SignatureSpace />;
  if (field.kind === "multiline") {
    return (
      <GrowingTextarea
        id={id}
        name={field.name}
        className="sign-comment"
        value={field.value ?? ""}
        onChange={(event) => onEdit(signId, field.name, event.target.value)}
      />
    );
  }
  if (field.kind === "date") {
    return (
      <DatePicker
        id={id}
        className="sign-date w-auto min-w-44"
        value={/^\d{4}-\d{2}-\d{2}$/.test(field.value ?? "") ? field.value ?? "" : ""}
        onChange={(value) => onEdit(signId, field.name, value)}
      />
    );
  }
  if (field.kind === "text") {
    return (
      <Input
        id={id}
        name={field.name}
        className="sign-text"
        autoComplete={field.name === "lead_name" ? "name" : undefined}
        spellCheck={field.name === "lead_name" ? false : undefined}
        value={field.value ?? ""}
        onChange={(event) => onEdit(signId, field.name, event.target.value)}
      />
    );
  }
  return null;
}

function BoxedFields({
  title,
  fields,
  inline,
  signId,
  onEdit,
}: {
  title: string;
  fields: SignField[];
  inline: boolean;
  signId: string;
  onEdit: SignoffEdit;
}) {
  if (inline) {
    const signature = fields.find((field) => field.kind === "signature");
    return (
      <section className="sign-box" id={signId === "lead" ? "lead-signoff" : undefined}>
        {title ? <p className="sign-label">{title}</p> : null}
        <div className="sign-inline">
          {fields.filter((field) => field.kind !== "signature").map((field) => (
            <Field key={field.name} className="sign-inline-item">
              <FieldLabel htmlFor={`sign-${field.name}`} className="sign-label">{fieldLabel(field)}</FieldLabel>
              <SignControl field={field} signId={signId} onEdit={onEdit} />
            </Field>
          ))}
        </div>
        {signature ? (
          <>
            <p className="sign-label" id="lead-signature-label">{signature.label}</p>
            <p className="sign-hint">Leave this blank. Sign it by hand on the printed copy, or in the PDF.</p>
            <SignatureSpace />
          </>
        ) : null}
      </section>
    );
  }
  return (
    <section className="sign-box">
      {title ? <p className="sign-label">{title}</p> : null}
      {fields.map((field) => (
        <Field key={field.name}>
          <FieldLabel htmlFor={`sign-${field.name}`} className="sign-label">{field.label}</FieldLabel>
          <SignControl field={field} signId={signId} onEdit={onEdit} />
        </Field>
      ))}
    </section>
  );
}

function SignBlock({ block, onEdit }: { block: Block; onEdit: SignoffEdit }) {
  const fields = block.fields ?? [];
  const signId = block.signId ?? "";
  if (!fields.some((field) => field.kind === "choice")) {
    return <div className="sign-group">{BoxedFields({ title: block.text, fields, inline: true, signId, onEdit })}</div>;
  }
  const group = fields.find((field) => field.group)?.group ?? "ack";
  const selected = fields.find((field) => field.kind === "choice" && field.selected);
  const value = selected ? choiceValue(selected) : "";
  const boxed = fields.filter((field) => field.boxed);
  return (
    <div className="sign-group">
      <div className="ack-row">
        <p className="ack-statement">{block.text}</p>
        <div className="ack-controls">
          <RadioGroup
            name={group}
            value={value}
            className="flex flex-row flex-wrap gap-4"
            aria-label={`${block.text} acknowledgment`}
            onValueChange={(next) => {
              const field = fields.find((item) => item.kind === "choice" && choiceValue(item) === next);
              if (field) onEdit(signId, field.name, next);
            }}
          >
            {fields.filter((field) => field.kind === "choice").map((field) => {
              const id = `sign-${field.name}`;
              return (
                <Field key={field.name} orientation="horizontal" className="ack-choice w-auto items-center">
                  <RadioGroupItem id={id} value={choiceValue(field)} />
                  <FieldLabel htmlFor={id} className="font-normal">{field.label}</FieldLabel>
                </Field>
              );
            })}
          </RadioGroup>
          {fields.filter((field) => field.kind === "date").map((field) => (
            <Field key={field.name} orientation="horizontal" className="ack-date w-auto items-center">
              <FieldLabel htmlFor={`sign-${field.name}`} className="sign-label">Date</FieldLabel>
              <SignControl field={field} signId={signId} onEdit={onEdit} />
            </Field>
          ))}
        </div>
      </div>
      {boxed.length > 0 ? BoxedFields({ title: "", fields: boxed, inline: false, signId, onEdit }) : null}
    </div>
  );
}

function InventoryTable({ rows }: { rows: { field: string; value: string }[] }) {
  return (
    <table className="inventory-table">
      <thead>
        <tr>
          <th scope="col">Field</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.field}>
            <th scope="row">{row.field}</th>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BlockNode({ block, onEdit }: { block: Block; onEdit: SignoffEdit }) {
  if (block.type === "sign") return <SignBlock block={block} onEdit={onEdit} />;
  if (block.type === "step") return null;
  if (block.type === "break") return <div className="sheet-break" />;
  if (block.type === "table") return <InventoryTable rows={block.rows ?? []} />;
  const className = block.text.startsWith("Aligned to:") ? `r-${block.type} r-aligned` : `r-${block.type}`;
  const content = block.text;
  if (block.type === "h1") return <h1 id={block.anchor} className={`${className} report-title`}>{content}</h1>;
  if (block.type === "h2") return <h2 id={block.anchor} className={className}>{content}</h2>;
  if (block.type === "h3") return <h3 id={block.anchor} className={className}>{content}</h3>;
  if (block.type === "p" || block.type === "label" || block.type === "field" || block.type === "note" || block.type === "qa" || block.type === "bullet" || block.type === "sub") {
    return <p id={block.anchor} className={className}>{content}</p>;
  }
  const unexpected: never = block.type;
  return unexpected;
}

function Blocks({ blocks, onEdit }: { blocks: Block[]; onEdit: SignoffEdit }) {
  const nodes: ReactNode[] = [];
  let steps: Block[] = [];
  const flush = () => {
    if (steps.length === 0) return;
    const items = steps;
    steps = [];
    nodes.push(
      <ol key={`steps-${nodes.length}`} className="r-steps">
        {items.map((block, index) => (
          <li key={`${block.text}-${index}`}>
            {block.link ? <a href={`#${block.link}`}>{block.text}</a> : block.text}
            {(block.aside ?? "").split("\n").filter(Boolean).map((line) => (
              <div key={line} className="r-aside">{line}</div>
            ))}
          </li>
        ))}
      </ol>,
    );
  };
  blocks.forEach((block, index) => {
    if (block.type === "step") {
      steps.push(block);
      return;
    }
    flush();
    nodes.push(<BlockNode key={`${block.type}-${index}`} block={block} onEdit={onEdit} />);
  });
  flush();
  return <>{nodes}</>;
}

export function ReportArticle({ doc, onEdit }: { doc: ReportDoc; onEdit: SignoffEdit }) {
  return (
    <article className="sheet" id="report">
      {doc.documents.map((part, index) => (
        <section key={part.key} className="doc-part" aria-label={part.title}>
          {index > 0 ? <hr className="doc-rule" /> : null}
          <Blocks blocks={part.blocks} onEdit={onEdit} />
        </section>
      ))}
    </article>
  );
}
