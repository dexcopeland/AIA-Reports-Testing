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

interface PdfKitDoc {
  initForm(): PdfKitDoc;
  switchToPage(index: number): PdfPage;
  formText(name: string, x: number, y: number, w: number, h: number, options?: Record<string, unknown>): unknown;
  annotate(x: number, y: number, w: number, h: number, options: Record<string, unknown>): unknown;
  _fieldDict(name: string, type: string | null, options: Record<string, unknown>): Record<string, unknown>;
  _addToParent(ref: unknown): unknown;
  _ctm: number[];
  page: PdfPage;
  _pageBuffer: PdfPage[];
  _root: {
    data: {
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

function place(doc: PdfKitDoc, field: SignField, spot: FieldSpot): void {
  doc.switchToPage(spot.page);
  const height = doc.page.height;
  doc._ctm = [1, 0, 0, -1, 0, height];
  const baseline = height - spot.y;
  const top = Math.max(36, baseline - 2);
  const boxHeight = Math.max(18, field.lines * 16);
  const width = Math.max(140, doc.page.width - 78 - spot.x);
  switch (field.kind) {
    case "text":
      doc.formText(field.name, spot.x, top, width, boxHeight, { fontSize: 12 });
      break;
    case "multiline":
      doc.formText(field.name, spot.x, top, width, boxHeight, { multiline: true, fontSize: 12 });
      break;
    case "signature":
      addSignature(doc, field.name, spot.x, top, width, boxHeight);
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
  for (const field of fields) {
    const spot = placed.get(field.name);
    if (!spot) throw new Error(`No PDF destination for sign-off field ${field.name}.`);
    place(doc, field, spot);
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
