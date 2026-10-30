import type { SignField } from "../engine/report";

interface PdfRef {
  id: number;
}

interface PdfPage {
  height: number;
  width: number;
  dictionary: PdfRef;
  annotations: unknown[];
}

interface PdfRef {
  data: Record<string, unknown>;
  end(chunk?: string): void;
}

interface PdfKitDoc {
  initForm(): PdfKitDoc;
  switchToPage(index: number): PdfPage;
  formText(name: string, x: number, y: number, w: number, h: number, options?: Record<string, unknown>): unknown;
  annotate(x: number, y: number, w: number, h: number, options: Record<string, unknown>): unknown;
  ref(data: Record<string, unknown>): PdfRef;
  _fieldDict(name: string, type: string | null, options: Record<string, unknown>): Record<string, unknown>;
  _addToParent(ref: unknown): unknown;
  _ctm: number[];
  page: PdfPage;
  _pageBuffer: PdfPage[];
  _root: {
    data: {
      AcroForm?: { data: { Fields: unknown[] } };
      Names?: { data?: { Dests?: { _items: Record<string, unknown[]> } } };
    };
  };
  on(event: "data", listener: (chunk: Uint8Array) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  end(): void;
}

interface FieldSpot {
  page: number;
  x: number;
  y: number;
}

function spots(doc: PdfKitDoc): Map<string, FieldSpot> {
  const items = doc._root.data.Names?.data?.Dests?._items ?? {};
  const found = new Map<string, FieldSpot>();
  for (const [name, dest] of Object.entries(items)) {
    if (!name.startsWith("fld_")) continue;
    const pageRef = dest[0] as PdfRef | undefined;
    const x = dest[2];
    const y = dest[3];
    const page = doc._pageBuffer.findIndex((item) => item.dictionary === pageRef || item.dictionary.id === pageRef?.id);
    if (page < 0 || typeof x !== "number" || typeof y !== "number") continue;
    found.set(name.slice("fld_".length), { page, x, y });
  }
  return found;
}

function addSignature(doc: PdfKitDoc, name: string, x: number, y: number, w: number, h: number): void {
  const fieldDict = doc._fieldDict(name, null, {});
  fieldDict.FT = "Sig";
  fieldDict.Subtype = "Widget";
  fieldDict.F = 4;
  doc.annotate(x, y, w, h, fieldDict);
  const annotRef = doc.page.annotations[doc.page.annotations.length - 1];
  doc._addToParent(annotRef);
}

function appearance(doc: PdfKitDoc, content: string): PdfRef {
  const stream = doc.ref({
    Type: "XObject",
    Subtype: "Form",
    BBox: [0, 0, 12, 12],
  });
  stream.end(content);
  return stream;
}

const NAVY = "0.039 0.192 0.380";
const BOX_OFF = `q ${NAVY} RG 0.8 w 0.6 0.6 10.8 10.8 re S Q`;
const BOX_ON = `${BOX_OFF} q ${NAVY} rg 2.6 2.6 6.8 6.8 re f Q`;

function radioParent(doc: PdfKitDoc, groups: Map<string, PdfRef>, group: string): PdfRef {
  const existing = groups.get(group);
  if (existing) return existing;
  const dict = doc._fieldDict(group, "radioButton", { noToggleToOff: true });
  const flags = typeof dict.Ff === "number" ? dict.Ff : 0;
  dict.Ff = flags | 0x8000 | 0x4000;
  dict.V = "Off";
  const parent = doc.ref(dict);
  const fields = doc._root.data.AcroForm?.data.Fields;
  if (!fields) throw new Error("The PDF form was not started.");
  fields.push(parent);
  groups.set(group, parent);
  return parent;
}

function addChoice(doc: PdfKitDoc, field: SignField, x: number, y: number, groups: Map<string, PdfRef>, off: PdfRef): void {
  const group = field.group ?? field.name;
  const parent = radioParent(doc, groups, group);
  const onState = field.label === "No" ? "No" : "Yes";
  const on = appearance(doc, BOX_ON);
  const widget = doc._fieldDict(onState, "radioButton", { parent });
  delete widget.T;
  delete widget.FT;
  delete widget.Ff;
  widget.Parent = parent;
  widget.Subtype = "Widget";
  widget.F = 4;
  widget.AS = "Off";
  widget.AP = { N: { [onState]: on, Off: off } };
  doc.annotate(x, y, 12, 12, widget);
  const annotRef = doc.page.annotations[doc.page.annotations.length - 1];
  doc._addToParent(annotRef);
}

function fieldBox(field: SignField, doc: PdfKitDoc, spot: FieldSpot): { width: number; height: number; top: number } {
  const height = doc.page.height;
  const baseline = height - spot.y;
  switch (field.kind) {
    case "choice":
      return { width: 12, height: 12, top: Math.max(36, baseline - 10) };
    case "date":
      return { width: field.width ?? 72, height: 14, top: Math.max(36, baseline - 11) };
    case "text":
      return { width: field.width ?? Math.max(80, doc.page.width - 78 - spot.x), height: 14, top: Math.max(36, baseline - 11) };
    case "multiline":
      return { width: Math.max(140, doc.page.width - 78 - spot.x), height: Math.max(24, field.lines * 13), top: Math.max(36, baseline - 2) };
    case "signature":
      return { width: Math.max(140, doc.page.width - 78 - spot.x), height: 34, top: Math.max(36, baseline - 2) };
    default: {
      const unknown: never = field.kind;
      throw new Error(`Unknown sign-off field ${String(unknown)}`);
    }
  }
}

function place(doc: PdfKitDoc, field: SignField, spot: FieldSpot, groups: Map<string, PdfRef>, off: PdfRef): void {
  doc.switchToPage(spot.page);
  doc._ctm = [1, 0, 0, -1, 0, doc.page.height];
  const box = fieldBox(field, doc, spot);
  switch (field.kind) {
    case "choice":
      addChoice(doc, field, spot.x, box.top, groups, off);
      break;
    case "date":
    case "text":
      doc.formText(field.name, spot.x, box.top, box.width, box.height, { fontSize: 11 });
      break;
    case "multiline":
      doc.formText(field.name, spot.x, box.top, box.width, box.height, { multiline: true, fontSize: 11 });
      break;
    case "signature":
      addSignature(doc, field.name, spot.x, box.top, box.width, box.height);
      break;
    default: {
      const unknown: never = field.kind;
      throw new Error(`Unknown sign-off field ${String(unknown)}`);
    }
  }
}

/** Add AcroForm widgets at the sign-off destinations pdfmake already laid out. */
export function addAcroFormFields(doc: PdfKitDoc, fields: SignField[]): void {
  if (fields.length === 0) return;
  doc.initForm();
  const placed = spots(doc);
  const groups = new Map<string, PdfRef>();
  const off = appearance(doc, BOX_OFF);
  for (const field of fields) {
    const spot = placed.get(field.name);
    if (!spot) throw new Error(`No PDF destination for sign-off field ${field.name}.`);
    place(doc, field, spot, groups, off);
  }
}

export function collectPdf(doc: PdfKitDoc): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk) => {
      chunks.push(chunk instanceof Uint8Array ? chunk : Uint8Array.from(chunk));
    });
    doc.on("end", () => {
      const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const out = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
      }
      resolve(out);
    });
    doc.on("error", reject);
    doc.end();
  });
}
