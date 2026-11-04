import { mkdirSync, writeFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";
import { buildReport, documentView } from "../src/engine/report";
import { reportToPdfBytes } from "../src/pdf/build-pdf";
import { buildScenario } from "../src/scenarios/build";
import { SCENARIOS } from "../src/scenarios/catalog";

const outDir = process.env.AIA_PAGES ?? "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const scenario = SCENARIOS.find((item) => item.id === (process.env.AIA_SCENARIO ?? "S01"));
if (!scenario) throw new Error("Scenario missing");
const report = buildReport(buildScenario(scenario));
for (const part of report.documents) {
  const { bytes } = await reportToPdfBytes(documentView(report, part));
  const filename = `${part.slug}.pdf`;
  writeFileSync(`${outDir}/${filename}`, bytes);
  console.log(filename, bytes.byteLength);
  const parser = new PDFParse({ data: bytes });
  const shot = await parser.getScreenshot({ imageBuffer: true, scale: 1.5, first: 1 });
  const page = shot.pages[0];
  if (page) {
    writeFileSync(`${outDir}/${part.slug}-page-1.png`, page.data);
    console.log(`${part.slug}-page-1.png`, page.pageNumber, page.width, page.height);
  }
  await parser.destroy();
}
