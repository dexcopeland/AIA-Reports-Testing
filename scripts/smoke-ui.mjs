import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const base = process.env.AIA_URL ?? "http://127.0.0.1:4173";
const outDir = process.env.AIA_SHOTS ?? "/tmp/aia-smoke";
await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const failures = [];
page.on("pageerror", (error) => failures.push(String(error)));
page.on("requestfailed", (request) => failures.push(`request failed ${request.url()}`));
page.on("response", (response) => {
  if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) failures.push(`HTTP ${response.status()} ${response.url()}`);
});

await page.goto(base, { waitUntil: "networkidle0" });
const title = await page.title();
if (!title.includes("Algorithmic Impact Assessment")) failures.push(`Unexpected title: ${title}`);
await page.screenshot({ path: `${outDir}/01-home.png` });

await page.click("button::-p-text(Load an example)");
await page.waitForSelector("#section-heading");
const section = await page.$eval("#section-heading", (node) => node.textContent);
if (!section?.includes("About this request")) failures.push(`Unexpected section: ${section}`);

const agency = await page.$eval("#q2_agency", (node) => node.value);
if (!agency.includes("fictional")) failures.push("Example agency was not loaded.");
await page.screenshot({ path: `${outDir}/02-example-section.png` });

await page.click('button[aria-current="step"]');
const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent || "");
await page.keyboard.press("Tab");
const afterTab = await page.evaluate(() => document.activeElement?.tagName);
if (!afterTab) failures.push("Tab did not move focus.");

const attest = await page.$('button::-p-text(7. Attestation)');
if (!attest) failures.push("Attestation step missing.");
await attest?.click();
await page.waitForFunction(() => document.querySelector("#section-heading")?.textContent?.includes("Attestation"));
const confirmed = await page.$eval("#q25_confirm-confirm", (node) => node.checked);
if (!confirmed) failures.push("Example Q25 was not confirmed.");

await page.click("button::-p-text(Review and create draft)");
await page.waitForSelector("#report");
const reportText = await page.$eval("#report", (node) => node.innerText);
if (!reportText.includes("OutreachMap Grant Outreach Ranker (fictional)")) failures.push("Report title missing the example system.");
if (!reportText.includes("Draft for DoIT AI Governance review.")) failures.push("Draft banner missing.");
if (!reportText.includes("1 July 2027")) failures.push("Deadline missing from the example report.");
if (reportText.includes("agency.lead@")) failures.push("An email leaked into the report.");
if (reportText.toLowerCase().includes("quietly")) failures.push("Banned word in the report.");
await page.screenshot({ path: `${outDir}/03-report.png`, fullPage: false });

await page.setViewport({ width: 390, height: 800 });
await page.screenshot({ path: `${outDir}/04-report-mobile.png` });

const client = await page.createCDPSession();
await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: outDir });
await page.click("button::-p-text(Download Word)");
await page.waitForFunction(() => document.body.innerText.includes("Word file downloaded"), { timeout: 15000 }).catch(() => {
  failures.push("Word download did not confirm.");
});

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Smoke passed.", { section, focused, afterTab });
