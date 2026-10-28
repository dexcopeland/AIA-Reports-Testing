import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  TextRun,
  type FileChild,
} from "docx";
import type { Block, ReportDoc } from "../engine/report";
import { REPORT_STYLE } from "../report/style";

const RED = REPORT_STYLE.red;
const BODY = REPORT_STYLE.body;
const MUTED = REPORT_STYLE.muted;
const FONT = REPORT_STYLE.font;

function run(text: string, options: { size: number; bold?: boolean; color?: string; font?: string }): TextRun {
  return new TextRun({
    text,
    font: options.font ?? FONT,
    size: options.size,
    bold: options.bold,
    color: options.color ?? BODY,
  });
}

function paragraphFrom(block: Block): FileChild[] {
  if (block.type === "break") return [new Paragraph({ children: [new PageBreak()] })];
  if (block.type === "h1") {
    return [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        border: { bottom: { color: RED, space: 1, style: BorderStyle.SINGLE, size: 12 } },
        spacing: { after: 200 },
        children: [run(block.text, { size: REPORT_STYLE.titlePt * 2, bold: true, color: RED })],
      }),
    ];
  }
  if (block.type === "h2") {
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280, after: 120 },
        children: [run(block.text, { size: REPORT_STYLE.headingPt * 2, bold: true, color: RED })],
      }),
    ];
  }
  if (block.type === "h3") {
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
        children: [run(block.text, { size: Math.round(REPORT_STYLE.subheadPt * 2), bold: true, color: RED })],
      }),
    ];
  }
  if (block.type === "label") {
    return [
      new Paragraph({
        spacing: { before: 160, after: 40 },
        keepNext: true,
        children: [run(block.text, { size: 24, bold: true, color: RED })],
      }),
    ];
  }
  if (block.type === "bullet") {
    return [
      new Paragraph({
        numbering: { reference: "answer-relied-on", level: 0 },
        spacing: { before: 40, after: 20 },
        children: [run(block.text, { size: 24 })],
      }),
    ];
  }
  if (block.type === "sub") {
    return [
      new Paragraph({
        spacing: { before: 0, after: 60 },
        indent: { left: 1080 },
        children: [run(block.text, { size: 24 })],
      }),
    ];
  }
  if (block.type === "note") {
    return [
      new Paragraph({
        spacing: { after: 80 },
        children: [run(block.text, { size: 22, color: MUTED })],
      }),
    ];
  }
  if (block.type === "qa") {
    const lines = block.text.split("\n");
    return lines.map(
      (line, index) =>
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: "F4F7FB" },
          border: index === 0 ? { left: { color: REPORT_STYLE.rule, space: 8, style: BorderStyle.SINGLE, size: 16 } } : undefined,
          spacing: { after: index === lines.length - 1 ? 160 : 40 },
          children: [run(line || " ", { size: 24 })],
        }),
    );
  }
  const aligned = block.text.startsWith("Aligned to:");
  const answerLead = block.text.startsWith("Answer relied on (");
  return [
    new Paragraph({
      spacing: { before: aligned ? 240 : 0, after: answerLead ? 80 : 120 },
      children: [run(block.text, { size: 24 })],
    }),
  ];
}

export async function reportToDocxBlob(doc: ReportDoc): Promise<Blob> {
  const children = doc.blocks.flatMap((item) => paragraphFrom(item));
  const footer = new Footer({
    children: [
      new Paragraph({
        children: [
          run(`Algorithmic Impact Assessment · ${doc.systemName} · Page `, { size: 18, color: MUTED }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: MUTED }),
          run(" of ", { size: 18, color: MUTED }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: MUTED }),
        ],
      }),
    ],
  });
  const document = new Document({
    numbering: {
      config: [
        {
          reference: "answer-relied-on",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
                run: {
                  font: FONT,
                  size: 24,
                },
              },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 24, color: BODY },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        footers: { default: footer },
        children,
      },
    ],
  });
  return Packer.toBlob(document);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
