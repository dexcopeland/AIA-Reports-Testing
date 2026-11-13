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
  if (response.status() >= 400 && !response.url().endsWith("/favicon.ico"))
    failures.push(`HTTP ${response.status()} ${response.url()}`);
});

const banner = "Agency draft — not approval. Send DoIT the signed Executive Summary.";
await page.goto(base, { waitUntil: "networkidle0" });
const title = await page.title();
const homeText = await page.$eval("body", (node) => node.innerText);
if (!homeText.includes(banner)) failures.push("Home banner missing.");
if (homeText.includes("Draft for DoIT AI Governance review."))
  failures.push("Old DoIT-review framing is still on the home screen.");
if (!title.includes("Algorithmic Impact Assessment")) failures.push(`Unexpected title: ${title}`);
await page.screenshot({ path: `${outDir}/01-home.png` });

const sticky = await page.$eval("#site-header", (node) => getComputedStyle(node).position);
if (sticky !== "sticky") failures.push(`Header is ${sticky}, expected sticky.`);
const saveCount = await page.$$eval("#save-draft", (nodes) => nodes.length);
if (saveCount !== 1) failures.push(`Expected one Save draft button, found ${saveCount}.`);
const saveInRail = await page.$eval("#save-draft", (node) =>
  Boolean(node.closest("#progress-rail")),
);
if (!saveInRail) failures.push("Save draft is not at the bottom of the progress rail.");
const zipInRail = await page.$eval("#download-zip", (node) => {
  const rail = node.closest("#progress-rail");
  if (!rail) return false;
  const actions = rail.lastElementChild;
  return (
    actions instanceof HTMLElement &&
    actions.contains(node) &&
    actions.contains(rail.querySelector("#save-draft"))
  );
});
if (!zipInRail) failures.push("Save and zip are not together at the bottom of the progress rail.");

await page.click("#example-select");
await page.waitForSelector("[data-slot='select-item']");
const exampleLabels = await page.$$eval("[data-slot='select-item']", (nodes) =>
  nodes.map((node) => node.textContent ?? ""),
);
if (exampleLabels.length !== 14)
  failures.push(`Expected 14 examples, found ${exampleLabels.length}.`);
if (!exampleLabels.some((label) => label.includes("High-risk:")))
  failures.push("Example menu does not label a High-risk example.");
if (!exampleLabels.some((label) => label.includes("General Impact Assessment:")))
  failures.push("Example menu does not label a General Impact Assessment example.");
if (!exampleLabels.some((label) => label.includes("Prohibited:")))
  failures.push("Example menu does not label a Prohibited example.");
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
if (!selectedLook.text.includes("Benefits eligibility triage"))
  failures.push(`Closed select text: ${selectedLook.text}`);
if (selectedLook.color === selectedLook.background)
  failures.push("Selected example text matches its background.");
await page.click("#load-example");
await page.waitForSelector("#section-heading");
const section = await page.$eval("#section-heading", (node) => node.textContent);
if (!section?.includes("About this request")) failures.push(`Unexpected section: ${section}`);

const agency = await page.$eval("#q2_agency", (node) => node.value);
if (!agency.includes("fictional")) failures.push("Example agency was not loaded.");
const highPath = await page.$eval("#assessment-path", (node) => node.textContent ?? "");
if (!highPath.includes("Path: High")) failures.push(`High path note missing: ${highPath}`);
const highRailPath = await page.$eval("#rail-assessment-path", (node) => node.textContent ?? "");
if (!highRailPath.includes("Path: High")) failures.push(`Rail path note missing: ${highRailPath}`);
if (!(await page.$("#q1_intake"))) failures.push("High path hid the optional intake reference.");
const highRail = await page.$eval("#progress-rail", (node) => node.innerText);
if (!highRail.includes("Status")) failures.push("High rail is missing the status section.");
const railProgress = await page.$eval(
  "#progress-rail",
  (node) => node.querySelector("[role='progressbar']") !== null,
);
if (!railProgress) failures.push("Progress is not in the left rail.");
const stepVisible = await page.evaluate(() => {
  const nav = document.querySelector("[aria-label='Sections']");
  const current = nav?.querySelector("[aria-current='step']");
  if (!(nav instanceof HTMLElement) || !(current instanceof HTMLElement)) return false;
  const navBox = nav.getBoundingClientRect();
  const box = current.getBoundingClientRect();
  return (
    box.top >= navBox.top - 1 &&
    box.bottom <= navBox.bottom + 1 &&
    box.left >= navBox.left - 1 &&
    box.right <= navBox.right + 1 &&
    (current.textContent ?? "").includes("About this request")
  );
});
if (!stepVisible) failures.push("Current section step is clipped in the progress rail.");
const questionCards = await page.$$eval("[data-question]", (nodes) => nodes.length);
if (questionCards < 2) failures.push(`Expected question cards, found ${questionCards}.`);
const widened = await page.$eval(
  "#assessment-column",
  (node) => Number.parseFloat(getComputedStyle(node).maxWidth) > 52 * 16,
);
if (!widened) failures.push("Main column is still the narrow 52rem measure.");
await page.screenshot({ path: `${outDir}/02-example-section.png` });

await page.click('button[aria-current="step"]');
const stored = await page.evaluate(() => localStorage.getItem("md-aia-draft-v1") ?? "");
if (!stored.includes("fictional"))
  failures.push("Section navigation did not keep the saved draft.");
const focused = await page.evaluate(
  () => document.activeElement?.id || document.activeElement?.textContent || "",
);
await page.keyboard.press("Tab");
const afterTab = await page.evaluate(() => document.activeElement?.tagName);
if (!afterTab) failures.push("Tab did not move focus.");

const attest = await page.$("button::-p-text(7. Attestation)");
if (!attest) failures.push("Attestation step missing.");
await attest?.click();
await page.waitForFunction(() =>
  document.querySelector("#section-heading")?.textContent?.includes("Attestation"),
);
const confirmed = await page.$eval("#q25_confirm-confirm", (node) =>
  node instanceof HTMLInputElement ? node.checked : node.getAttribute("aria-checked") === "true",
);
if (!confirmed) failures.push("Example Q25 was not confirmed.");

await page.click("button::-p-text(Review and create draft)");
await page.waitForSelector("#report");
const reportText = await page.$eval("#report", (node) => node.innerText);
if (!reportText.includes("Benefits Eligibility Triage (fictional)"))
  failures.push("Report title missing the example system.");
if (!reportText.includes(banner)) failures.push("Draft banner missing.");
if (reportText.includes("Draft for DoIT AI Governance review."))
  failures.push("Old DoIT-review banner is still in the report.");
if (reportText.includes("The risk level is High-risk."))
  failures.push("BLUF still says every draft is High-risk.");
if (!reportText.includes("The path is High.")) failures.push("High BLUF path line missing.");
if (!reportText.includes("High-risk because it impacts rights"))
  failures.push("High BLUF does not say the use impacts rights.");
if (!reportText.includes("Q8 names Benefits or public services"))
  failures.push("High BLUF does not name the Q8 rights check.");
if (!reportText.includes("Capabilities:"))
  failures.push("High executive summary is missing capabilities.");
if (!reportText.includes("Inventory under SF&P § 3.5-803(b)"))
  failures.push("High inventory table heading missing.");
if (!reportText.includes("Keep the full report package in the agency's records."))
  failures.push("Executive purpose paragraph missing.");
if (!reportText.includes("1 July 2027")) failures.push("Deadline missing from the example report.");
if (!reportText.includes("Jordan Hale"))
  failures.push("Agency Lead name is missing from the report.");
if (!reportText.includes("jordan.hale@example.gov"))
  failures.push("Agency Lead email is missing from the report.");
if (reportText.toLowerCase().includes("quietly")) failures.push("Banned word in the report.");
await page.screenshot({ path: `${outDir}/03-report.png`, fullPage: false });

await page.setViewport({ width: 390, height: 800 });
await page.screenshot({ path: `${outDir}/04-report-mobile.png` });

const client = await page.createCDPSession();
await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: outDir });
await page.click("button::-p-text(Download report package (.zip))");
await page
  .waitForFunction(() => document.body.innerText.includes("Report package downloaded"), {
    timeout: 20000,
  })
  .catch(() => {
    failures.push("Report package download did not confirm.");
  });

await page.setViewport({ width: 1280, height: 900 });
await page.click("#go-home");
await page.waitForSelector("#example-select");
await page.click("#example-select");
await page.waitForSelector("[data-slot='select-item']");
await page.click("[data-slot='select-item']::-p-text(General Impact Assessment: Grounds forecast)");
await page.waitForFunction(() => {
  const button = document.querySelector("#load-example");
  return button instanceof HTMLButtonElement && !button.disabled;
});
await page.click("#load-example");
await page.waitForFunction(() =>
  document.querySelector("#assessment-path")?.textContent?.includes("Path: General"),
);
const generalPath = await page.$eval("#assessment-path", (node) => node.textContent ?? "");
if (!generalPath.includes("The short question set is open."))
  failures.push(`General path note missing: ${generalPath}`);
if (await page.$("#q1_intake")) failures.push("General path shows the High intake reference.");
const generalRail = await page.$eval("#progress-rail", (node) => node.innerText);
if (/\bStatus\b/.test(generalRail)) failures.push("General rail still lists the status section.");
if (!generalRail.includes("Attestation")) failures.push("General rail is missing attestation.");
await page.click("button::-p-text(Risks and safeguards)");
await page.waitForFunction(() =>
  document.querySelector("#section-heading")?.textContent?.includes("Risks"),
);
const risks = await page.$eval("#main", (node) => node.innerText);
if (risks.includes("Protections for each threat"))
  failures.push("General path shows the High threat questions.");
if (!risks.includes("What could go wrong"))
  failures.push("General path is missing what could go wrong.");
if (!risks.includes("Accuracy testing")) failures.push("General path is missing accuracy.");
await page.click("button::-p-text(Attestation)");
await page.waitForFunction(() =>
  document.querySelector("#section-heading")?.textContent?.includes("Attestation"),
);
const generalConfirmed = await page.$eval("#q25_confirm-confirm", (node) =>
  node instanceof HTMLInputElement ? node.checked : node.getAttribute("aria-checked") === "true",
);
if (!generalConfirmed) failures.push("General example Q25 was not confirmed.");
await page.click("button::-p-text(Review and create draft)");
await page.waitForSelector("#report");
const generalReport = await page.$eval("#report", (node) => node.innerText);
if (!generalReport.includes(banner)) failures.push("General report banner missing.");
if (!generalReport.includes("The path is General."))
  failures.push("General BLUF path line missing.");
if (!generalReport.includes("no High or Prohibited fact applies"))
  failures.push("General BLUF reason missing.");
if (!generalReport.includes("Capabilities:"))
  failures.push("General executive summary is missing capabilities.");
if (generalReport.includes("Inventory under SF&P § 3.5-803(b)"))
  failures.push("General report includes the High inventory table.");
if (generalReport.includes("The risk level is High-risk."))
  failures.push("General BLUF still says High-risk.");
await page.click("#download-zip");
await page
  .waitForFunction(() => document.body.innerText.includes("Report package downloaded"), {
    timeout: 20000,
  })
  .catch(() => {
    failures.push("General path report package download did not confirm.");
  });

// --- Keyboard-only pass: Tab, Enter, and arrow keys only. No mouse. ---
try {
  await page.evaluate(() => localStorage.clear());
  await page.goto(base, { waitUntil: "networkidle0" });

  const activeInfo = () =>
    page.evaluate(() => ({
      id: document.activeElement?.id ?? "",
      text: (document.activeElement?.textContent ?? "").trim(),
    }));

  async function tabUntil(test, label, limit = 90) {
    for (let i = 0; i < limit; i += 1) {
      if (await page.evaluate(test)) return;
      await page.keyboard.press("Tab");
    }
    throw new Error(`did not reach ${label}`);
  }

  await page.keyboard.press("Tab");
  if (!(await activeInfo()).text.includes("Skip to content"))
    failures.push("The first keyboard stop is not the skip link.");
  await page.keyboard.press("Enter");
  const skipLanded = await page
    .waitForFunction(() => document.activeElement?.id === "main", { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!skipLanded) failures.push("The skip link did not move keyboard focus to #main.");

  await tabUntil(() => document.activeElement?.id === "example-select", "the example select");
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-slot='select-item']", { timeout: 5000 }).catch(async () => {
    await page.keyboard.press("ArrowDown");
    await page.waitForSelector("[data-slot='select-item']", { timeout: 5000 });
  });
  for (let i = 0; i < 20; i += 1) {
    const highlighted = await page.evaluate(() =>
      Boolean(
        document
          .querySelector("[data-slot='select-item'][data-highlighted]")
          ?.textContent?.includes("Benefits eligibility triage"),
      ),
    );
    if (highlighted) break;
    await page.keyboard.press("ArrowDown");
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  await page.keyboard.press("Enter");
  const backOnTrigger = await page
    .waitForFunction(() => document.activeElement?.id === "example-select", { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!backOnTrigger)
    failures.push("Selecting an example by keyboard did not return focus to the select.");
  const picked = await page.evaluate(() =>
    Boolean(
      document
        .querySelector("#example-select")
        ?.textContent?.includes("Benefits eligibility triage"),
    ),
  );
  if (!picked) failures.push("Keyboard selection did not choose the Benefits example.");
  await page.keyboard.press("Tab");
  const loadFocused = await page
    .waitForFunction(() => document.activeElement?.id === "load-example", { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!loadFocused)
    failures.push("Keyboard did not land on Load this example after selecting one.");
  if (loadFocused) {
    await page.keyboard.press("Enter");
    const headingFocused = await page
      .waitForFunction(() => document.activeElement?.id === "section-heading", { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!headingFocused)
      failures.push("Loading an example by keyboard did not focus the section heading.");
  }

  const stepCount = await page.$$eval("#progress-rail nav li", (nodes) => nodes.length);
  const continueSteps = stepCount - 1; // sections, excluding the draft-report step
  for (let step = 1; step <= continueSteps; step += 1) {
    const last = step === continueSteps;
    await tabUntil(
      () =>
        ["Save and continue", "Review and create draft"].includes(
          (document.activeElement?.textContent ?? "").trim(),
        ),
      `the continue button for step ${step} of ${continueSteps}`,
    );
    await page.keyboard.press("Enter");
    const moved = await page
      .waitForFunction(() => document.activeElement?.id === "section-heading", { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!moved)
      failures.push(`Focus did not move to the section heading after keyboard step ${step}.`);
    if (last) await page.waitForSelector("#report", { timeout: 10000 });
  }

  await tabUntil(() => document.activeElement?.id === "save-draft", "Save draft in the rail");
  await page.keyboard.press("Enter");
  const savedNote = await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("#save-status, #header-save-status")].some((node) =>
          (node.textContent ?? "").includes("Draft file downloaded."),
        ),
      { timeout: 10000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!savedNote) failures.push("Keyboard save did not show the draft-downloaded note.");

  await tabUntil(
    () => document.activeElement?.id === "download-zip",
    "the zip download in the rail",
  );
  await page.keyboard.press("Enter");
  const zipNote = await page
    .waitForFunction(
      () =>
        (document.querySelector("#export-status")?.textContent ?? "").includes(
          "Report package downloaded",
        ),
      { timeout: 20000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!zipNote) failures.push("Keyboard zip download did not confirm.");
} catch (error) {
  failures.push(
    `Keyboard-only pass failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Smoke passed.", { section, focused, afterTab });
