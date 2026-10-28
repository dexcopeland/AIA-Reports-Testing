import { mkdirSync, writeFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";
import { buildReport } from "../src/engine/report";
import { reportToPdfBytes } from "../src/pdf/build-pdf";
import { buildScenario } from "../src/scenarios/build";
import { SCENARIOS } from "../src/scenarios/catalog";

const outDir = process.env.AIA_PAGES ?? "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const scenario = SCENARIOS.find((item) => item.id === "S01");
if (!scenario) throw new Error("S01 missing");
const report = buildReport(buildScenario(scenario));
const bytes = await reportToPdfBytes(report);
writeFileSync(`${outDir}/s01-report.pdf`, bytes);
const parser = new PDFParse({ data: bytes });
const text = await parser.getText();
const pages = text.pages ?? [];
let rpPage = 1;
for (const page of pages) {
  const pageText = "text" in page ? String(page.text) : "";
  if (pageText.includes("Recommended practice checks")) {
    rpPage = "num" in page ? Number(page.num) : pages.indexOf(page) + 1;
    break;
  }
}
const shots = await parser.getScreenshot({ imageBuffer: true, scale: 1.5, partial: [1, rpPage] });
for (const page of shots.pages) {
  const name = page.pageNumber === 1 ? "pdf-page-1.png" : "pdf-rp-page.png";
  writeFileSync(`${outDir}/${name}`, page.data);
  console.log(name, page.pageNumber, page.width, page.height);
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
