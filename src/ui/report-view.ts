import type { Block, ReportDoc, SignField } from "../engine/report";

export type SignoffEdit = (signId: string, fieldName: string, value: string) => void;

function choiceControl(field: SignField, group: string, onChange: (value: string) => void): HTMLElement {
  const label = document.createElement("label");
  label.className = "ack-choice";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = group;
  input.value = field.label === "No" ? "no" : "yes";
  input.checked = Boolean(field.selected);
  input.addEventListener("change", () => {
    if (input.checked) onChange(input.value);
  });
  label.append(input, document.createTextNode(` ${field.label}`));
  return label;
}

function dateField(field: SignField, onChange: (value: string) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "date";
  input.className = "sign-date";
  input.name = field.name;
  input.id = `sign-${field.name}`;
  input.value = /^\d{4}-\d{2}-\d{2}$/.test(field.value ?? "") ? field.value ?? "" : "";
  input.addEventListener("input", () => onChange(input.value));
  return input;
}

function dateControl(field: SignField, onChange: (value: string) => void): HTMLElement {
  const label = document.createElement("label");
  label.className = "ack-date";
  label.htmlFor = `sign-${field.name}`;
  const caption = document.createElement("span");
  caption.textContent = "Date";
  label.append(caption, dateField(field, onChange));
  return label;
}

function textInput(field: SignField, onChange: (value: string) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "sign-text";
  input.name = field.name;
  input.id = `sign-${field.name}`;
  if (field.name === "lead_name") input.autocomplete = "name";
  input.spellcheck = field.name !== "lead_name";
  input.value = field.value ?? "";
  input.addEventListener("input", () => onChange(input.value));
  return input;
}

function commentInput(field: SignField, onChange: (value: string) => void): HTMLElement {
  const supportsSizing = CSS.supports("field-sizing", "content");
  const wrap = document.createElement("div");
  wrap.className = supportsSizing ? "sign-comment-wrap" : "grow-wrap";
  const area = document.createElement("textarea");
  area.className = "sign-comment";
  area.name = field.name;
  area.id = `sign-${field.name}`;
  area.value = field.value ?? "";
  area.addEventListener("input", () => {
    if (!supportsSizing) wrap.dataset.replicatedValue = area.value;
    onChange(area.value);
  });
  wrap.append(area);
  if (!supportsSizing) wrap.dataset.replicatedValue = area.value;
  return wrap;
}

function signatureSpace(): HTMLElement {
  const space = document.createElement("div");
  space.className = "sign-write sign-signature";
  space.setAttribute("aria-hidden", "true");
  return space;
}

function fieldLabel(field: SignField): string {
  if (field.kind === "text" && field.label.startsWith("Title")) return "Title";
  return field.label;
}

function boxedFields(title: string, fields: SignField[], inline: boolean, signId: string, onEdit: SignoffEdit): HTMLElement {
  const box = document.createElement("section");
  box.className = "sign-box";
  if (signId === "lead") box.id = "lead-signoff";
  if (title) {
    const heading = document.createElement("p");
    heading.className = "sign-label";
    heading.textContent = title;
    box.append(heading);
  }
  const write = (field: SignField): HTMLElement => {
    if (field.kind === "signature") return signatureSpace();
    if (field.kind === "multiline") return commentInput(field, (value) => onEdit(signId, field.name, value));
    if (field.kind === "date") return dateField(field, (value) => onEdit(signId, field.name, value));
    return textInput(field, (value) => onEdit(signId, field.name, value));
  };
  if (inline) {
    const row = document.createElement("div");
    row.className = "sign-inline";
    for (const field of fields) {
      if (field.kind === "signature") continue;
      const item = document.createElement("label");
      item.className = "sign-inline-item";
      item.htmlFor = `sign-${field.name}`;
      const name = document.createElement("span");
      name.className = "sign-label";
      name.textContent = fieldLabel(field);
      item.append(name, write(field));
      row.append(item);
    }
    box.append(row);
    const signature = fields.find((field) => field.kind === "signature");
    if (signature) {
      const label = document.createElement("p");
      label.className = "sign-label";
      label.id = "lead-signature-label";
      label.textContent = signature.label;
      const note = document.createElement("p");
      note.className = "sign-hint";
      note.textContent = "Leave this blank. Sign it by hand on the printed copy, or in the PDF.";
      box.append(label, note, signatureSpace());
    }
    return box;
  }
  for (const field of fields) {
    const label = document.createElement("label");
    label.className = "sign-label";
    label.htmlFor = `sign-${field.name}`;
    label.textContent = field.label;
    box.append(label, write(field));
  }
  return box;
}

function renderSign(block: Block, onEdit: SignoffEdit): HTMLElement {
  const fields = block.fields ?? [];
  const signId = block.signId ?? "";
  const wrap = document.createElement("div");
  wrap.className = "sign-group";
  if (!fields.some((field) => field.kind === "choice")) {
    wrap.append(boxedFields(block.text, fields, true, signId, onEdit));
    return wrap;
  }
  const row = document.createElement("div");
  row.className = "ack-row";
  const statement = document.createElement("p");
  statement.className = "ack-statement";
  statement.textContent = block.text;
  const controls = document.createElement("div");
  controls.className = "ack-controls";
  const group = fields.find((field) => field.group)?.group ?? "ack";
  for (const field of fields) {
    if (field.kind === "choice") controls.append(choiceControl(field, group, (value) => onEdit(signId, field.name, value)));
    else if (field.kind === "date") controls.append(dateControl(field, (value) => onEdit(signId, field.name, value)));
  }
  row.append(statement, controls);
  wrap.append(row);
  const boxed = fields.filter((field) => field.boxed);
  if (boxed.length > 0) wrap.append(boxedFields("", boxed, false, signId, onEdit));
  return wrap;
}

function renderBlocks(article: HTMLElement, blocks: Block[], onEdit: SignoffEdit): void {
  let list: HTMLOListElement | null = null;
  const closeList = () => {
    list = null;
  };
  for (const block of blocks) {
    if (block.type === "step") {
      if (!list) {
        list = document.createElement("ol");
        list.className = "r-steps";
        article.append(list);
      }
      const item = document.createElement("li");
      if (block.link) {
        const link = document.createElement("a");
        link.href = `#${block.link}`;
        link.textContent = block.text;
        item.append(link);
      } else item.append(document.createTextNode(block.text));
      for (const line of (block.aside ?? "").split("\n").filter(Boolean)) {
        const detail = document.createElement("div");
        detail.className = "r-aside";
        detail.textContent = line;
        item.append(detail);
      }
      list.append(item);
      continue;
    }
    closeList();
    if (block.type === "sign") {
      article.append(renderSign(block, onEdit));
      continue;
    }
    if (block.type === "break") continue;
    const tag = block.type === "h1" ? "h1" : block.type === "h2" ? "h2" : block.type === "h3" ? "h3" : "p";
    const el = document.createElement(tag);
    el.className = block.text.startsWith("Aligned to:") ? `r-${block.type} r-aligned` : `r-${block.type}`;
    el.textContent = block.text;
    if (block.anchor) el.id = block.anchor;
    if (block.type === "h1") el.classList.add("report-title");
    article.append(el);
  }
}

export function renderReport(doc: ReportDoc, onEdit: SignoffEdit = () => {}): HTMLElement {
  const article = document.createElement("article");
  article.className = "sheet";
  article.id = "report";
  doc.documents.forEach((part, index) => {
    const section = document.createElement("section");
    section.className = "doc-part";
    section.setAttribute("aria-label", part.title);
    if (index > 0) {
      const rule = document.createElement("hr");
      rule.className = "doc-rule";
      section.append(rule);
    }
    renderBlocks(section, part.blocks, onEdit);
    article.append(section);
  });
  return article;
}
