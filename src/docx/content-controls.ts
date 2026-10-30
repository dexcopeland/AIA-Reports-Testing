import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function writingParagraph(): string {
  return [
    "<w:p>",
    "<w:pPr><w:spacing w:before=\"60\" w:after=\"160\"/></w:pPr>",
    "<w:r><w:rPr>",
    "<w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\" w:cs=\"Times New Roman\"/>",
    "<w:sz w:val=\"24\"/><w:szCs w:val=\"24\"/>",
    "</w:rPr><w:t xml:space=\"preserve\"> </w:t></w:r>",
    "</w:p>",
  ].join("");
}

function contentControl(name: string, lines: number, label: string, id: number): string {
  const count = Math.max(1, lines);
  const paragraphs = Array.from({ length: count }, () => writingParagraph()).join("");
  return [
    "<w:sdt>",
    "<w:sdtPr>",
    `<w:alias w:val="${xmlEscape(label)}"/>`,
    `<w:tag w:val="${xmlEscape(name)}"/>`,
    `<w:id w:val="${id}"/>`,
    "</w:sdtPr>",
    `<w:sdtContent>${paragraphs}</w:sdtContent>`,
    "</w:sdt>",
  ].join("");
}

const MARKER = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?\{\{cc\|([^|]+)\|(\d+)\|([^}]*)\}\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g;

/** Replace sign-off marker paragraphs with Word content controls. */
export function applyContentControls(bytes: Uint8Array): Uint8Array {
  const files = unzipSync(bytes);
  const path = "word/document.xml";
  const source = files[path];
  if (!source) throw new Error("The Word file has no document.xml.");
  let nextId = 3000;
  const xml = strFromU8(source).replace(MARKER, (_paragraph, name: string, lines: string, label: string) => {
    nextId += 1;
    return contentControl(name, Number(lines), label, nextId);
  });
  if (xml.includes("{{cc|")) throw new Error("A sign-off field was left as plain text.");
  files[path] = strToU8(xml);
  return zipSync(files);
}
