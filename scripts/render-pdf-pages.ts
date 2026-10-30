import { mkdirSync, writeFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";
import { buildReport } from "../src/engine/report";
import { reportToPdfBytes } from "../src/pdf/build-pdf";
import { buildScenario } from "../src/scenarios/build";
import { SCENARIOS } from "../src/scenarios/catalog";

const outDir = process.env.AIA_PAGES ?? "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const scenario = SCENARIOS.find((item) => item.id === (process.env.AIA_SCENARIO ?? "S01"));
if (!scenario) throw new Error("S01 missing");
const report = buildReport(buildScenario(scenario));
const { bytes } = await reportToPdfBytes(report);
writeFileSync(`${outDir}/s01-report.pdf`, bytes);
const parser = new PDFParse({ data: bytes });
const text = await parser.getText();
const pages = text.pages ?? [];
const namesForPage = new Map<number, string[]>();
const addName = (number: number, name: string) => {
  const names = namesForPage.get(number) ?? [];
  if (!names.includes(name)) names.push(name);
  namesForPage.set(number, names);
};
pages.forEach((page, index) => {
  const pageText = "text" in page ? String(page.text) : "";
  const number = "num" in page ? Number(page.num) : index + 1;
  if (number === 1) addName(number, "pdf-page-1.png");
  if (pageText.includes("Bottom line up front")) addName(number, "pdf-bluf.png");
  if (pageText.includes("Agency Lead signature") || pageText.includes("Agency Lead sign-off")) addName(number, "pdf-signoff.png");
  if (pageText.includes("C9 –")) addName(number, "pdf-c9.png");
  if (pageText.includes("RP1 –")) addName(number, "pdf-rp1.png");
  if (pageText.includes("RP2 –") || pageText.includes("RP3 –")) addName(number, `pdf-rp-page-${number}.png`);
});
const shots = await parser.getScreenshot({ imageBuffer: true, scale: 1.5, partial: [...namesForPage.keys()] });
for (const page of shots.pages) {
  for (const name of namesForPage.get(page.pageNumber) ?? []) {
    writeFileSync(`${outDir}/${name}`, page.data);
    console.log(name, page.pageNumber, page.width, page.height);
  }
}
const c9 = report.blocks.filter((block) => block.text.startsWith("C9") || block.text.startsWith("What we found") || block.text.startsWith("Answer relied on"));
console.log("--- nearby C9 ---");
const all = report.blocks.map((block) => block.text);
const c9At = all.findIndex((line) => line.startsWith("C9 –"));
const rp1At = all.findIndex((line) => line.startsWith("RP1 –"));
console.log(all.slice(c9At, c9At + 3).join("\n"));
console.log("---");
console.log(all.slice(rp1At, rp1At + 3).join("\n"));
await parser.destroy();
void c9;
