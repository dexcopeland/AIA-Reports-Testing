import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import type { Block, ReportDoc } from "../engine/report";
import { REPORT_STYLE } from "../report/style";

type PdfContent = Record<string, unknown>;

let fontsReady: Promise<void> | null = null;

async function fontBase64(filename: string): Promise<string> {
  const url = new URL(`../fonts/${filename}`, import.meta.url);
  if (url.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    return Buffer.from(await readFile(url)).toString("base64");
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${filename}`);
  return bytesToBase64(new Uint8Array(await response.arrayBuffer()));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function ensureFonts(): Promise<void> {
  fontsReady ??= (async () => {
    const [regular, bold] = await Promise.all([
      fontBase64("SourceSansPro-Regular.ttf"),
      fontBase64("SourceSansPro-Bold.ttf"),
    ]);
    pdfMake.addVirtualFileSystem({
      ...pdfFonts,
      "SourceSansPro-Regular.ttf": regular,
      "SourceSansPro-Bold.ttf": bold,
    });
    pdfMake.addFonts({
      SourceSansPro: {
        normal: "SourceSansPro-Regular.ttf",
        bold: "SourceSansPro-Bold.ttf",
        italics: "SourceSansPro-Regular.ttf",
        bolditalics: "SourceSansPro-Bold.ttf",
      },
    });
  })();
  return fontsReady;
}

function blockContent(block: Block): PdfContent | PdfContent[] {
  if (block.type === "break") return { text: "", pageBreak: "before" };
  if (block.type === "h1") {
    return [
      {
        text: block.text,
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
      text: block.text,
      fontSize: REPORT_STYLE.headingPt,
      bold: true,
      color: `#${REPORT_STYLE.navy}`,
      margin: [0, 14, 0, 6],
    };
  }
  if (block.type === "h3") {
    return {
      text: block.text,
      fontSize: REPORT_STYLE.subheadPt,
      bold: true,
      color: `#${REPORT_STYLE.navy}`,
      margin: [0, 10, 0, 4],
    };
  }
  if (block.type === "label") {
    return {
      text: block.text,
      fontSize: REPORT_STYLE.bodyPt,
      bold: true,
      color: `#${REPORT_STYLE.navy}`,
      margin: [0, 8, 0, 2],
    };
  }
  if (block.type === "note") {
    return { text: block.text, fontSize: REPORT_STYLE.notePt, color: `#${REPORT_STYLE.muted}`, margin: [0, 0, 0, 4] };
  }
  if (block.type === "qa") {
    return {
      table: {
        widths: [3, "*"],
        body: [[
          { text: "", fillColor: `#${REPORT_STYLE.rule}` },
          { text: block.text, fillColor: `#${REPORT_STYLE.shade}`, margin: [6, 4, 6, 4] },
        ]],
      },
      layout: "noBorders",
      margin: [0, 2, 0, 8],
    };
  }
  const aligned = block.text.startsWith("Aligned to:");
  const answerLead = block.text.startsWith("Answer relied on (");
  return {
    text: block.text,
    fontSize: REPORT_STYLE.bodyPt,
    margin: aligned ? [0, 12, 0, 6] : answerLead ? [0, 2, 0, 4] : [0, 0, 0, 6],
  };
}

function blocksToPdf(blocks: Block[]): PdfContent[] {
  const content: PdfContent[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.type !== "bullet") {
      const piece = blockContent(block);
      if (Array.isArray(piece)) content.push(...piece);
      else content.push(piece);
      continue;
    }
    const stack: PdfContent[] = [{ text: block.text }];
    while (blocks[index + 1]?.type === "sub") {
      index += 1;
      stack.push({ text: blocks[index].text, margin: [14, 1, 0, 0] });
    }
    content.push({
      columns: [
        { width: 12, text: "•", font: "SourceSansPro", fontSize: REPORT_STYLE.bodyPt },
        { width: "*", stack },
      ],
      columnGap: 4,
      margin: [2, 3, 0, 2],
    });
  }
  return content;
}

export function reportDefinition(doc: ReportDoc): Record<string, unknown> {
  return {
    pageSize: "LETTER",
    pageMargins: [REPORT_STYLE.marginPt, REPORT_STYLE.marginPt, REPORT_STYLE.marginPt, REPORT_STYLE.marginPt + 8],
    defaultStyle: {
      font: "SourceSansPro",
      fontSize: REPORT_STYLE.bodyPt,
      color: `#${REPORT_STYLE.body}`,
      lineHeight: 1.25,
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `Algorithmic Impact Assessment · ${doc.systemName} · Page ${currentPage} of ${pageCount}`,
      alignment: "center",
      fontSize: REPORT_STYLE.footerPt,
      color: `#${REPORT_STYLE.muted}`,
      margin: [REPORT_STYLE.marginPt, 8, REPORT_STYLE.marginPt, 0],
    }),
    content: blocksToPdf(doc.blocks),
  };
}

export async function reportToPdfBytes(doc: ReportDoc): Promise<Uint8Array> {
  await ensureFonts();
  const pdf = pdfMake.createPdf(reportDefinition(doc));
  const buffer = await pdf.getBuffer();
  return new Uint8Array(buffer);
}

export async function reportToPdfBlob(doc: ReportDoc): Promise<Blob> {
  const bytes = await reportToPdfBytes(doc);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "application/pdf" });
}
