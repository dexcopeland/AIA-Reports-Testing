import type { ReportDoc } from "../engine/report";

export function renderReport(doc: ReportDoc): HTMLElement {
  const article = document.createElement("article");
  article.className = "sheet";
  article.id = "report";
  for (const block of doc.blocks) {
    if (block.type === "break") {
      const marker = document.createElement("div");
      marker.className = "page-break";
      marker.setAttribute("aria-hidden", "true");
      article.append(marker);
      continue;
    }
    const tag = block.type === "h1" ? "h1" : block.type === "h2" ? "h2" : block.type === "h3" ? "h3" : block.type === "qa" ? "p" : block.type === "label" ? "p" : "p";
    const el = document.createElement(tag);
    el.className = block.text.startsWith("Aligned to:") ? `r-${block.type} r-aligned` : `r-${block.type}`;
    if (block.type === "qa") el.textContent = block.text;
    else el.textContent = block.text;
    if (block.type === "h1") el.classList.add("report-title");
    article.append(el);
  }
  return article;
}
