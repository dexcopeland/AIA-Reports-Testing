import {
  AlignmentType,
  Bookmark,
  BorderStyle,
  CheckBox,
  Document,
  Footer,
  HeadingLevel,
  InternalHyperlink,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  type FileChild,
} from "docx";
import type { Block, ReportDoc, SignField } from "../engine/report";
import { REPORT_STYLE } from "../report/style";
import { applyContentControls } from "./content-controls";

const NAVY = REPORT_STYLE.navy;
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

function childrenOf(block: Block, options: { size: number; bold?: boolean; color?: string }): (TextRun | Bookmark)[] {
  const text = run(block.text, options);
  if (!block.anchor) return [text];
  return [new Bookmark({ id: block.anchor, children: [text] })];
}

const openBorder = { style: BorderStyle.NIL, size: 0, color: "FFFFFF" };
const openBorders = { top: openBorder, bottom: openBorder, left: openBorder, right: openBorder };
const lineBorder = { style: BorderStyle.SINGLE, size: 6, color: NAVY };
const boxBorders = { top: lineBorder, bottom: lineBorder, left: lineBorder, right: lineBorder };

function fieldMarker(field: SignField): TextRun {
  return run(`{{cc|${field.name}|${field.lines}|${field.label}}}`, { size: 22 });
}

function acknowledgmentTable(block: Block): Table {
  const fields = block.fields ?? [];
  const yes = fields.find((field) => field.kind === "choice" && field.label === "Yes");
  const no = fields.find((field) => field.kind === "choice" && field.label === "No");
  const date = fields.find((field) => field.kind === "date");
  const choiceCell = (field: SignField | undefined, width: number) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: openBorders,
    margins: { top: 20, bottom: 20, left: 40, right: 40 },
    children: [
      new Paragraph({
        spacing: { before: 20, after: 20 },
        children: field
          ? [run(`${field.label} `, { size: 22 }), new CheckBox({ alias: `${field.label} ${field.group ?? field.name}` })]
          : [run(" ", { size: 22 })],
      }),
    ],
  });
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [5460, 1100, 1000, 1800],
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 5460, type: WidthType.DXA },
            borders: openBorders,
            margins: { top: 20, bottom: 20, left: 0, right: 60 },
            children: [new Paragraph({ spacing: { before: 20, after: 20 }, children: [run(block.text, { size: 22 })] })],
          }),
          choiceCell(yes, 1100),
          choiceCell(no, 1000),
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            borders: { ...openBorders, bottom: lineBorder },
            margins: { top: 20, bottom: 20, left: 60, right: 0 },
            children: [
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: date ? [run("Date ", { size: 22, bold: true, color: NAVY }), fieldMarker(date)] : [run(" ", { size: 22 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function commentTable(field: SignField): Table {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 9360, type: WidthType.DXA },
            borders: boxBorders,
            shading: { type: ShadingType.CLEAR, fill: REPORT_STYLE.shade },
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            children: [
              new Paragraph({ spacing: { after: 20 }, children: [run(field.label, { size: 22, bold: true, color: NAVY })] }),
              new Paragraph({ spacing: { before: 0, after: 0 }, children: [fieldMarker(field)] }),
            ],
          }),
        ],
      }),
    ],
  });
}

function leadTable(fields: SignField[]): Table {
  const lineFields = fields.filter((field) => field.kind === "text" || field.kind === "date");
  const signature = fields.find((field) => field.kind === "signature");
  const widths = [3120, 3600, 2640];
  const cells = lineFields.map((field, index) => new TableCell({
    width: { size: widths[index] ?? 3120, type: WidthType.DXA },
    borders: boxBorders,
    shading: { type: ShadingType.CLEAR, fill: REPORT_STYLE.shade },
    margins: { top: 30, bottom: 30, left: 60, right: 60 },
    children: [
      new Paragraph({
        spacing: { before: 20, after: 20 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY, space: 1 } },
        children: [run(`${field.label.startsWith("Title") ? "Title" : field.label} `, { size: 22, bold: true, color: NAVY }), fieldMarker(field)],
      }),
    ],
  }));
  const signatureCell = new TableCell({
    columnSpan: 3,
    width: { size: 9360, type: WidthType.DXA },
    borders: boxBorders,
    shading: { type: ShadingType.CLEAR, fill: REPORT_STYLE.shade },
    margins: { top: 30, bottom: 40, left: 60, right: 60 },
    children: [
      new Paragraph({ spacing: { after: 20 }, children: [run(signature?.label ?? "Signature", { size: 22, bold: true, color: NAVY })] }),
      new Paragraph({ children: signature ? [fieldMarker(signature)] : [run(" ", { size: 22 })] }),
    ],
  });
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ cantSplit: true, children: cells }),
      new TableRow({ cantSplit: true, children: [signatureCell] }),
    ],
  });
}

function signTable(block: Block): FileChild[] {
  const fields = block.fields ?? [];
  if (fields.some((field) => field.kind === "choice")) {
    const comment = fields.find((field) => field.boxed);
    return [acknowledgmentTable(block), ...(comment ? [commentTable(comment)] : [])];
  }
  return [
    new Paragraph({
      spacing: { before: 120, after: 40 },
      keepNext: true,
      children: [run(block.text, { size: 22, bold: true, color: NAVY })],
    }),
    leadTable(fields),
  ];
}

function paragraphFrom(block: Block): FileChild[] {
  if (block.type === "break") return [new Paragraph({ children: [new PageBreak()] })];
  if (block.type === "h1") {
    return [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        border: { bottom: { color: NAVY, space: 1, style: BorderStyle.SINGLE, size: 12 } },
        spacing: { after: 200 },
        children: childrenOf(block, { size: REPORT_STYLE.titlePt * 2, bold: true, color: NAVY }),
      }),
    ];
  }
  if (block.type === "h2") {
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280, after: 120 },
        children: childrenOf(block, { size: REPORT_STYLE.headingPt * 2, bold: true, color: NAVY }),
      }),
    ];
  }
  if (block.type === "h3") {
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
        children: childrenOf(block, { size: Math.round(REPORT_STYLE.subheadPt * 2), bold: true, color: NAVY }),
      }),
    ];
  }
  if (block.type === "label") {
    return [
      new Paragraph({
        spacing: { before: 160, after: 40 },
        keepNext: true,
        children: childrenOf(block, { size: 24, bold: true, color: NAVY }),
      }),
    ];
  }
  if (block.type === "step") {
    return [
      new Paragraph({
        numbering: { reference: "follow-up-steps", level: 0 },
        spacing: { before: 40, after: 40 },
        children: [
          new InternalHyperlink({
            anchor: block.link ?? "",
            children: [
              new TextRun({
                text: block.text,
                font: FONT,
                size: 24,
                style: "Hyperlink",
                color: REPORT_STYLE.rule,
                underline: { type: UnderlineType.SINGLE, color: REPORT_STYLE.rule },
              }),
            ],
          }),
        ],
      }),
    ];
  }
  if (block.type === "sign") return signTable(block);
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
          border: index === 0 ? { left: { color: "1B4F8A", space: 8, style: BorderStyle.SINGLE, size: 16 } } : undefined,
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
          reference: "follow-up-steps",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 720, hanging: 360 } },
                run: { font: FONT, size: 24 },
              },
            },
          ],
        },
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
      characterStyles: [
        {
          id: "Hyperlink",
          name: "Hyperlink",
          basedOn: "DefaultParagraphFont",
          run: {
            color: REPORT_STYLE.rule,
            underline: { type: UnderlineType.SINGLE, color: REPORT_STYLE.rule },
          },
        },
      ],
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
  const raw = await Packer.toBlob(document);
  const next = applyContentControls(new Uint8Array(await raw.arrayBuffer()));
  const copy = new Uint8Array(next.byteLength);
  copy.set(next);
  return new Blob([copy], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
