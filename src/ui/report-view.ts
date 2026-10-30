import type { Block, ReportDoc, SignField } from "../engine/report";

function signBox(block: Block): HTMLElement {
  const box = document.createElement("section");
  box.className = "sign-box";
  const title = document.createElement("p");
  title.className = "r-label";
  title.textContent = block.text.split("\n")[0] ?? "";
  box.append(title);
  for (const field of block.fields ?? []) box.append(signField(field));
  return box;
}

function signField(field: SignField): HTMLElement {
  const row = document.createElement("div");
  row.className = "sign-field";
  const label = document.createElement("p");
  label.className = "sign-label";
  label.textContent = field.label;
  const space = document.createElement("div");
  space.className = field.kind === "signature" ? "sign-write sign-signature" : field.kind === "multiline" ? "sign-write sign-multiline" : "sign-write";
  space.style.minHeight = `${Math.max(field.lines, 1) * 1.35}rem`;
  row.append(label, space);
  return row;
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
      article.append(signBox(block));
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
