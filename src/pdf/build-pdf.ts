import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import type { Block, ReportDoc } from "../engine/report";
import { REPORT_STYLE } from "../report/style";
import { familyCoverage, glyphWarnings, openFont, pdfText, type GlyphFont, type GlyphWarning } from "./glyphs";

type PdfContent = Record<string, unknown>;

interface LoadedFaces {
  primary: GlyphFont;
  fallback: GlyphFont;
}

let fontsReady: Promise<LoadedFaces> | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

const FONT_FILES = [
  "LiberationSerif-Regular.ttf",
  "LiberationSerif-Bold.ttf",
  "LiberationSerif-Italic.ttf",
  "LiberationSerif-BoldItalic.ttf",
  "DejaVuSerif.ttf",
  "DejaVuSerif-Bold.ttf",
  "DejaVuSerif-Italic.ttf",
  "DejaVuSerif-BoldItalic.ttf",
] as const;

async function fontBytes(filename: string): Promise<Uint8Array> {
  const url = new URL(`../fonts/${filename}`, import.meta.url);
  if (url.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    return new Uint8Array(await readFile(url));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${filename}`);
  return new Uint8Array(await response.arrayBuffer());
}

function ensureFonts(): Promise<LoadedFaces> {
  fontsReady ??= (async () => {
    const loaded = await Promise.all(FONT_FILES.map(async (filename) => [filename, await fontBytes(filename)] as const));
    const files = Object.fromEntries(loaded.map(([filename, bytes]) => [filename, bytesToBase64(bytes)]));
    pdfMake.addVirtualFileSystem({ ...pdfFonts, ...files });
    pdfMake.addFonts({
      [REPORT_STYLE.pdfFamily]: {
        normal: "LiberationSerif-Regular.ttf",
        bold: "LiberationSerif-Bold.ttf",
        italics: "LiberationSerif-Italic.ttf",
        bolditalics: "LiberationSerif-BoldItalic.ttf",
      },
      [REPORT_STYLE.fallbackFamily]: {
        normal: "DejaVuSerif.ttf",
        bold: "DejaVuSerif-Bold.ttf",
        italics: "DejaVuSerif-Italic.ttf",
        bolditalics: "DejaVuSerif-BoldItalic.ttf",
      },
    });
    const byName = Object.fromEntries(loaded);
    const face = (filename: string): GlyphFont => openFont(byName[filename]);
    return {
      primary: familyCoverage([
        face("LiberationSerif-Regular.ttf"),
        face("LiberationSerif-Bold.ttf"),
        face("LiberationSerif-Italic.ttf"),
        face("LiberationSerif-BoldItalic.ttf"),
      ]),
      fallback: familyCoverage([
        face("DejaVuSerif.ttf"),
        face("DejaVuSerif-Bold.ttf"),
        face("DejaVuSerif-Italic.ttf"),
        face("DejaVuSerif-BoldItalic.ttf"),
      ]),
    };
  })();
  return fontsReady;
}

function paint(text: string, faces: LoadedFaces, missing: Set<string>): string | { text: string; font: string }[] {
  return pdfText(text, faces.primary, faces.fallback, REPORT_STYLE.pdfFamily, REPORT_STYLE.fallbackFamily, missing);
}

function blockContent(block: Block, faces: LoadedFaces, missing: Set<string>): PdfContent | PdfContent[] {
  if (block.type === "break") return { text: "", pageBreak: "before" };
  if (block.type === "h1") {
    return [
      {
        text: paint(block.text, faces, missing),
        fontSize: REPORT_STYLE.titlePt,
        bold: true,
        color: `#${REPORT_STYLE.navy}`,
        margin: [0, 0, 0, 4],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 468, y2: 0, lineWidth: 1, lineColor: `#${REPORT_STYLE.navy}` }],
        margin: [0, 0, 0, 10],
      },
    ];
  }
  if (block.type === "h2") {
    return {
      text: paint(block.text, faces, missing),
      fontSize: REPORT_STYLE.headingPt,
      bold: true,
      color: `#${REPORT_STYLE.navy}`,
      margin: [0, 14, 0, 6],
    };
  }
  if (block.type === "h3") {
    return {
      text: paint(block.text, faces, missing),
      fontSize: REPORT_STYLE.subheadPt,
      bold: true,
      color: `#${REPORT_STYLE.navy}`,
      margin: [0, 10, 0, 4],
    };
  }
  if (block.type === "label") {
    return {
      text: paint(block.text, faces, missing),
      fontSize: REPORT_STYLE.bodyPt,
      bold: true,
      color: `#${REPORT_STYLE.navy}`,
      margin: [0, 8, 0, 2],
    };
  }
  if (block.type === "note") {
    return { text: paint(block.text, faces, missing), fontSize: REPORT_STYLE.notePt, color: `#${REPORT_STYLE.muted}`, margin: [0, 0, 0, 4] };
  }
  if (block.type === "qa") {
    return {
      table: {
        widths: [3, "*"],
        body: [[
          { text: "", fillColor: `#${REPORT_STYLE.rule}` },
          { text: paint(block.text, faces, missing), fillColor: `#${REPORT_STYLE.shade}`, margin: [6, 4, 6, 4] },
        ]],
      },
      layout: "noBorders",
      margin: [0, 2, 0, 8],
    };
  }
  const aligned = block.text.startsWith("Aligned to:");
  const answerLead = block.text.startsWith("Answer relied on (");
  return {
    text: paint(block.text, faces, missing),
    fontSize: REPORT_STYLE.bodyPt,
    margin: aligned ? [0, 12, 0, 6] : answerLead ? [0, 2, 0, 4] : [0, 0, 0, 6],
  };
}

function blocksToPdf(blocks: Block[], faces: LoadedFaces, missing: Set<string>): PdfContent[] {
  const content: PdfContent[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.type !== "bullet") {
      const piece = blockContent(block, faces, missing);
      if (Array.isArray(piece)) content.push(...piece);
      else content.push(piece);
      continue;
    }
    const stack: PdfContent[] = [{ text: paint(block.text, faces, missing) }];
    while (blocks[index + 1]?.type === "sub") {
      index += 1;
      stack.push({ text: paint(blocks[index].text, faces, missing), margin: [14, 1, 0, 0] });
    }
    content.push({
      columns: [
        { width: 12, text: "•", font: REPORT_STYLE.pdfFamily, fontSize: REPORT_STYLE.bodyPt },
        { width: "*", stack },
      ],
      columnGap: 4,
      margin: [2, 3, 0, 2],
    });
  }
  return content;
}

export function reportDefinition(doc: ReportDoc, faces: LoadedFaces, missing: Set<string>): Record<string, unknown> {
  return {
    pageSize: "LETTER",
    pageMargins: [REPORT_STYLE.marginPt, REPORT_STYLE.marginPt, REPORT_STYLE.marginPt, REPORT_STYLE.marginPt + 8],
    defaultStyle: {
      font: REPORT_STYLE.pdfFamily,
      fontSize: REPORT_STYLE.bodyPt,
      color: `#${REPORT_STYLE.body}`,
      lineHeight: 1.25,
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: paint(`Algorithmic Impact Assessment · ${doc.systemName} · Page ${currentPage} of ${pageCount}`, faces, missing),
      alignment: "center",
      fontSize: REPORT_STYLE.footerPt,
      color: `#${REPORT_STYLE.muted}`,
      margin: [REPORT_STYLE.marginPt, 8, REPORT_STYLE.marginPt, 0],
    }),
    content: blocksToPdf(doc.blocks, faces, missing),
  };
}

export interface PdfResult {
  bytes: Uint8Array;
  warnings: GlyphWarning[];
}

export async function reportToPdfBytes(doc: ReportDoc): Promise<PdfResult> {
  const faces = await ensureFonts();
  const missing = new Set<string>();
  const pdf = pdfMake.createPdf(reportDefinition(doc, faces, missing));
  const buffer = await pdf.getBuffer();
  return { bytes: new Uint8Array(buffer), warnings: glyphWarnings(doc.blocks, [...missing]) };
}

export async function reportToPdfBlob(doc: ReportDoc): Promise<{ blob: Blob; warnings: GlyphWarning[] }> {
  const { bytes, warnings } = await reportToPdfBytes(doc);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return { blob: new Blob([copy], { type: "application/pdf" }), warnings };
}
