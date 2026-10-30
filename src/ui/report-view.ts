import type { Block, ReportDoc, SignField } from "../engine/report";

function choiceControl(field: SignField, group: string): HTMLElement {
  const label = document.createElement("label");
  label.className = "ack-choice";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = group;
  input.value = field.label;
  label.append(input, document.createTextNode(` ${field.label}`));
  return label;
}

function dateLine(): HTMLElement {
  const label = document.createElement("span");
  label.className = "ack-date";
  const line = document.createElement("span");
  line.className = "ack-date-line";
  label.append(document.createTextNode("Date"), line);
  return label;
}

function writeSpace(field: SignField): HTMLElement {
  const space = document.createElement("div");
  space.className = field.kind === "signature" ? "sign-write sign-signature" : field.kind === "multiline" ? "sign-write sign-multiline" : "sign-write";
  return space;
}

function boxedFields(title: string, fields: SignField[], inline: boolean): HTMLElement {
  const box = document.createElement("section");
  box.className = "sign-box";
  if (title) {
    const heading = document.createElement("p");
    heading.className = "sign-label";
    heading.textContent = title;
    box.append(heading);
  }
  if (inline) {
    const row = document.createElement("div");
    row.className = "sign-inline";
    for (const field of fields) {
      if (field.kind === "signature") continue;
      const item = document.createElement("label");
      item.className = "sign-inline-item";
      const name = document.createElement("span");
      name.className = "sign-label";
      name.textContent = field.label.startsWith("Title") ? "Title" : field.label;
      item.append(name, writeSpace(field));
      row.append(item);
    }
    box.append(row);
    const signature = fields.find((field) => field.kind === "signature");
    if (signature) {
      const label = document.createElement("p");
      label.className = "sign-label";
      label.textContent = signature.label;
      box.append(label, writeSpace(signature));
    }
    return box;
  }
  for (const field of fields) {
    const label = document.createElement("p");
    label.className = "sign-label";
    label.textContent = field.label;
    box.append(label, writeSpace(field));
  }
  return box;
}

function renderSign(block: Block): HTMLElement {
  const fields = block.fields ?? [];
  const wrap = document.createElement("div");
  wrap.className = "sign-group";
  if (!fields.some((field) => field.kind === "choice")) {
    wrap.append(boxedFields(block.text, fields, true));
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
    if (field.kind === "choice") controls.append(choiceControl(field, group));
    else if (field.kind === "date") controls.append(dateLine());
  }
  row.append(statement, controls);
  wrap.append(row);
  const boxed = fields.filter((field) => field.boxed);
  if (boxed.length > 0) wrap.append(boxedFields("", boxed, false));
  return wrap;
}

export function renderReport(doc: ReportDoc): HTMLElement {
  const article = document.createElement("article");
  article.className = "sheet";
  article.id = "report";
  let list: HTMLOListElement | null = null;
  const closeList = () => {
    list = null;
  };
  for (const block of doc.blocks) {
    if (block.type === "step") {
      if (!list) {
        list = document.createElement("ol");
        list.className = "r-steps";
        article.append(list);
      }
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${block.link ?? ""}`;
      link.textContent = block.text;
      item.append(link);
      list.append(item);
      continue;
    }
    closeList();
    if (block.type === "sign") {
      article.append(renderSign(block));
      continue;
    }
    if (block.type === "break") {
      const marker = document.createElement("div");
      marker.className = "page-break";
      marker.setAttribute("aria-hidden", "true");
      article.append(marker);
      continue;
    }
    const tag = block.type === "h1" ? "h1" : block.type === "h2" ? "h2" : block.type === "h3" ? "h3" : "p";
    const el = document.createElement(tag);
    el.className = block.text.startsWith("Aligned to:") ? `r-${block.type} r-aligned` : `r-${block.type}`;
    el.textContent = block.text;
    if (block.anchor) el.id = block.anchor;
    if (block.type === "h1") el.classList.add("report-title");
    article.append(el);
  }
  return article;
}
