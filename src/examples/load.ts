import type { AnswerFile } from "../content/types";
import { normalizeFile } from "../ui/storage";
import indexJson from "../../examples/index.json";

export interface ExampleEntry {
  id: string;
  title: string;
  description: string;
  file: string;
}

export interface ExampleGroup {
  id: string;
  label: string;
  examples: ExampleEntry[];
}

export interface ExampleIndex {
  groups: ExampleGroup[];
}

export const exampleIndex = indexJson as ExampleIndex;

const modules = import.meta.glob("../../examples/*.json", { eager: true, import: "default" }) as Record<string, unknown>;

export function loadExampleFile(fileName: string): AnswerFile {
  const key = Object.keys(modules).find((item) => item.endsWith(`/${fileName}`));
  if (!key) throw new Error(`Missing example file ${fileName}.`);
  return normalizeFile(modules[key]);
}
