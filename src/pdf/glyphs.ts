import * as fontkit from "fontkit";
import type { Block } from "../engine/report";

export interface GlyphFont {
  hasGlyphForCodePoint(codePoint: number): boolean;
}

export interface GlyphWarning {
  character: string;
  questions: string[];
}

export interface TextRun {
  text: string;
  font: string;
}

export function openFont(bytes: Uint8Array): GlyphFont {
  return fontkit.create(bytes);
}

/** A code point is covered only when every style of the family has a glyph for it. */
export function familyCoverage(faces: GlyphFont[]): GlyphFont {
  return {
    hasGlyphForCodePoint(codePoint: number) {
      return faces.every((face) => face.hasGlyphForCodePoint(codePoint));
    },
  };
}

function covers(font: GlyphFont, codePoint: number): boolean {
  if (codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d || codePoint === 0x20) return true;
  return font.hasGlyphForCodePoint(codePoint);
}

export function shapeText(text: string, primary: GlyphFont, fallback: GlyphFont, primaryName: string, fallbackName: string): { runs: TextRun[]; missing: string[] } {
  const runs: TextRun[] = [];
  const missing: string[] = [];
  let current = "";
  let currentFont = primaryName;
  const push = () => {
    if (!current) return;
    runs.push({ text: current, font: currentFont });
    current = "";
  };
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    const fontName = covers(primary, codePoint) ? primaryName : covers(fallback, codePoint) ? fallbackName : primaryName;
    if (!covers(primary, codePoint) && !covers(fallback, codePoint) && character.trim()) missing.push(character);
    if (fontName !== currentFont && current) push();
    currentFont = fontName;
    current += character;
  }
  push();
  return { runs, missing: [...new Set(missing)] };
}

function explicitQuestions(block: Block): string[] {
  const lead = /^Answer relied on \(([^)]+)\):/.exec(block.text);
  if (lead) return lead[1].split(",").map((part) => part.trim()).filter(Boolean);
  if (block.type === "label") {
    const appendix = /^Q(\d+)\./.exec(block.text);
    if (appendix) return [`Q${appendix[1]}`];
  }
  return [...new Set([...block.text.matchAll(/\(Q(\d+)\)/g)].map((match) => `Q${match[1]}`))];
}

function isHeading(block: Block): boolean {
  return block.type === "h1" || block.type === "h2" || block.type === "h3";
}

function isCriterion(block: Block): boolean {
  return block.type === "label" && /^(?:C\d+|RP\d+)\s*[–-]/.test(block.text);
}

/** Question ids for each block. Finding text before an answer lead inherits that lead. */
function questionContext(blocks: Block[]): string[][] {
  const own = blocks.map(explicitQuestions);
  const assigned = own.map((item) => [...item]);
  let start = 0;
  const fillFromLead = (end: number) => {
    let lead: string[] = [];
    for (let cursor = start; cursor < end; cursor += 1) {
      if (/^Answer relied on \(/.test(blocks[cursor].text)) {
        lead = own[cursor];
        break;
      }
    }
    if (lead.length === 0) return;
    for (let cursor = start; cursor < end; cursor += 1) {
      if (assigned[cursor].length === 0) assigned[cursor] = [...lead];
    }
  };
  for (let index = 0; index <= blocks.length; index += 1) {
    const boundary = index === blocks.length || isHeading(blocks[index]) || isCriterion(blocks[index]);
    if (!boundary) continue;
    fillFromLead(index);
    start = index + 1;
  }
  let carry: string[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    if (isHeading(blocks[index]) || isCriterion(blocks[index])) carry = [...assigned[index]];
    else if (own[index].length > 0) carry = own[index];
    else if (assigned[index].length === 0 && carry.length > 0) assigned[index] = [...carry];
  }
  return assigned;
}

export function glyphWarnings(blocks: Block[], missing: string[]): GlyphWarning[] {
  const questions = new Map<string, Set<string>>();
  for (const character of missing) questions.set(character, new Set());
  const context = questionContext(blocks);
  blocks.forEach((block, index) => {
    for (const character of missing) {
      if (!block.text.includes(character)) continue;
      const bucket = questions.get(character);
      if (!bucket) continue;
      const named = context[index] ?? [];
      if (named.length === 0) bucket.add("the report");
      else for (const question of named) bucket.add(question);
    }
  });
  return missing.map((character) => ({
    character,
    questions: [...(questions.get(character) ?? new Set(["the report"]))].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
  }));
}

export function pdfText(text: string, primary: GlyphFont, fallback: GlyphFont, primaryName: string, fallbackName: string, missing: Set<string>): string | TextRun[] {
  const shaped = shapeText(text, primary, fallback, primaryName, fallbackName);
  for (const character of shaped.missing) missing.add(character);
  if (shaped.runs.length === 0) return text;
  if (shaped.runs.length === 1 && shaped.runs[0].font === primaryName) return text;
  return shaped.runs;
}
