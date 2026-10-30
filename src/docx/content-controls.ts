import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const RUN_PROPS = "<w:rPr><w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\" w:cs=\"Times New Roman\"/><w:sz w:val=\"22\"/><w:szCs w:val=\"22\"/></w:rPr>";

function controlStart(name: string, label: string, id: number): string {
  return `<w:sdt><w:sdtPr><w:alias w:val="${xmlEscape(label)}"/><w:tag w:val="${xmlEscape(name)}"/><w:id w:val="${id}"/></w:sdtPr><w:sdtContent>`;
}

function inlineControl(name: string, label: string, id: number): string {
  return `${controlStart(name, label, id)}<w:r>${RUN_PROPS}<w:t xml:space="preserve"> </w:t></w:r></w:sdtContent></w:sdt>`;
}

function writingParagraph(): string {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="40"/></w:pPr><w:r>${RUN_PROPS}<w:t xml:space="preserve"> </w:t></w:r></w:p>`;
}

function blockControl(name: string, lines: number, label: string, id: number): string {
  const paragraphs = Array.from({ length: Math.max(1, lines) }, () => writingParagraph()).join("");
  return `${controlStart(name, label, id)}${paragraphs}</w:sdtContent></w:sdt>`;
}

const PARAGRAPH_MARKER = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?\{\{cc\|([^|]+)\|(\d+)\|([^}]*)\}\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g;
const RUN_MARKER = /<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?\{\{cc\|([^|]+)\|(\d+)\|([^}]*)\}\}(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g;

/** Replace sign-off markers with Word content controls. */
export function applyContentControls(bytes: Uint8Array): Uint8Array {
  const files = unzipSync(bytes);
  const path = "word/document.xml";
  const source = files[path];
  if (!source) throw new Error("The Word file has no document.xml.");
  let nextId = 3000;
  const withBlocks = strFromU8(source).replace(PARAGRAPH_MARKER, (paragraph, name: string, lines: string, label: string) => {
    if (Number(lines) <= 1) return paragraph;
    nextId += 1;
    return blockControl(name, Number(lines), label, nextId);
  });
  const xml = withBlocks.replace(RUN_MARKER, (_run, name: string, _lines: string, label: string) => {
    nextId += 1;
    return inlineControl(name, label, nextId);
  });
  if (xml.includes("{{cc|")) throw new Error("A sign-off field was left as plain text.");
  files[path] = strToU8(xml);
  return zipSync(files);
}
