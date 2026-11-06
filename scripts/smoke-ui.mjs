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

const sticky = await page.$eval("#site-header", (node) => getComputedStyle(node).position);
if (sticky !== "sticky") failures.push(`Header is ${sticky}, expected sticky.`);
const saveCount = await page.$$eval("#save-draft", (nodes) => nodes.length);
if (saveCount !== 1) failures.push(`Expected one Save draft button, found ${saveCount}.`);
const saveInRail = await page.$eval("#save-draft", (node) => Boolean(node.closest("#progress-rail")));
if (!saveInRail) failures.push("Save draft is not at the bottom of the progress rail.");
const zipInRail = await page.$eval("#download-zip", (node) => {
  const rail = node.closest("#progress-rail");
  if (!rail) return false;
  const actions = rail.lastElementChild;
  return actions instanceof HTMLElement && actions.contains(node) && actions.contains(rail.querySelector("#save-draft"));
});
if (!zipInRail) failures.push("Save and zip are not together at the bottom of the progress rail.");

await page.click("#example-select");
await page.waitForSelector("[data-slot='select-item']");
const exampleCount = await page.$$eval("[data-slot='select-item']", (nodes) => nodes.length);
if (exampleCount !== 10) failures.push(`Expected 10 examples, found ${exampleCount}.`);
await page.click("[data-slot='select-item']::-p-text(Benefits eligibility triage)");
await page.waitForFunction(() => {
  const button = document.querySelector("#load-example");
  return button instanceof HTMLButtonElement && !button.disabled;
});
const blurb = await page.$eval("#example-description", (node) => node.textContent);
if (!blurb?.includes("Eligibility staff")) failures.push(`Example description missing: ${blurb}`);
const selectedLook = await page.$eval("#example-select", (node) => {
  const style = getComputedStyle(node);
  return { text: node.textContent ?? "", color: style.color, background: style.backgroundColor };
});
if (!selectedLook.text.includes("Benefits eligibility triage")) failures.push(`Closed select text: ${selectedLook.text}`);
if (selectedLook.color === selectedLook.background) failures.push("Selected example text matches its background.");
await page.click("#load-example");
await page.waitForSelector("#section-heading");
const section = await page.$eval("#section-heading", (node) => node.textContent);
if (!section?.includes("About this request")) failures.push(`Unexpected section: ${section}`);

const agency = await page.$eval("#q2_agency", (node) => node.value);
if (!agency.includes("fictional")) failures.push("Example agency was not loaded.");
const railProgress = await page.$eval("#progress-rail", (node) => node.querySelector("[role='progressbar']") !== null);
if (!railProgress) failures.push("Progress is not in the left rail.");
const stepVisible = await page.evaluate(() => {
  const nav = document.querySelector("[aria-label='Sections']");
  const current = nav?.querySelector("[aria-current='step']");
  if (!(nav instanceof HTMLElement) || !(current instanceof HTMLElement)) return false;
  const navBox = nav.getBoundingClientRect();
  const box = current.getBoundingClientRect();
  return box.top >= navBox.top - 1 && box.bottom <= navBox.bottom + 1 && box.left >= navBox.left - 1 && box.right <= navBox.right + 1 && (current.textContent ?? "").includes("About this request");
});
if (!stepVisible) failures.push("Current section step is clipped in the progress rail.");
const questionCards = await page.$$eval("[data-question]", (nodes) => nodes.length);
if (questionCards < 2) failures.push(`Expected question cards, found ${questionCards}.`);
const widened = await page.$eval("#assessment-column", (node) => Number.parseFloat(getComputedStyle(node).maxWidth) > 52 * 16);
if (!widened) failures.push("Main column is still the narrow 52rem measure.");
await page.screenshot({ path: `${outDir}/02-example-section.png` });

await page.click('button[aria-current="step"]');
const stored = await page.evaluate(() => localStorage.getItem("md-aia-draft-v1") ?? "");
if (!stored.includes("fictional")) failures.push("Section navigation did not keep the saved draft.");
const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent || "");
await page.keyboard.press("Tab");
const afterTab = await page.evaluate(() => document.activeElement?.tagName);
if (!afterTab) failures.push("Tab did not move focus.");

const attest = await page.$('button::-p-text(7. Attestation)');
if (!attest) failures.push("Attestation step missing.");
await attest?.click();
await page.waitForFunction(() => document.querySelector("#section-heading")?.textContent?.includes("Attestation"));
const confirmed = await page.$eval("#q25_confirm-confirm", (node) => node instanceof HTMLInputElement ? node.checked : node.getAttribute("aria-checked") === "true");
if (!confirmed) failures.push("Example Q25 was not confirmed.");

await page.click("button::-p-text(Review and create draft)");
await page.waitForSelector("#report");
const reportText = await page.$eval("#report", (node) => node.innerText);
if (!reportText.includes("Benefits Eligibility Triage (fictional)")) failures.push("Report title missing the example system.");
if (!reportText.includes("Draft for DoIT AI Governance review.")) failures.push("Draft banner missing.");
if (!reportText.includes("1 July 2027")) failures.push("Deadline missing from the example report.");
if (reportText.includes("agency.lead@")) failures.push("An email leaked into the report.");
if (reportText.toLowerCase().includes("quietly")) failures.push("Banned word in the report.");
await page.screenshot({ path: `${outDir}/03-report.png`, fullPage: false });

await page.setViewport({ width: 390, height: 800 });
await page.screenshot({ path: `${outDir}/04-report-mobile.png` });

const client = await page.createCDPSession();
await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: outDir });
await page.click("button::-p-text(Download report package (.zip))");
await page.waitForFunction(() => document.body.innerText.includes("Report package downloaded"), { timeout: 20000 }).catch(() => {
  failures.push("Report package download did not confirm.");
});

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Smoke passed.", { section, focused, afterTab });
