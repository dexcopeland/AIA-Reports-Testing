# Maryland Algorithmic Impact Assessment (browser draft)

This is a no-AI, in-browser Algorithmic Impact Assessment for Maryland state agencies. An agency answers a structured form. The page builds a draft report with fixed rules. Nothing is sent to a server.

The draft is for DoIT AI Governance review. It does not approve an AI system.

It follows the shape of Canada's [AIA tool](https://github.com/canada-ca/aia-eia-js): a client-side questionnaire, a JSON file you can save and load, and deterministic scoring. The output here is a written 10-section report, not only a score.

## What an agency does

1. Open the GitHub Pages site (or run it locally).
2. Start a new assessment, or load an example. Examples are fictional and labeled.
3. Answer section by section. Later questions appear only when they apply. Statement sets run from weakest to strongest, plus "We don't know / not determined yet." A planned line asks for a target date. The strongest line can ask for one line of evidence.
4. The browser saves the draft on this computer. Use **Save JSON file** to download a copy. The file includes `schema_version`, `form_version` and `rules_version`.
5. Read the on-screen draft. After Q25 is confirmed, download a Word file or a PDF. Both are built from the same report. The PDF is not a browser print of the HTML page. It is generated in the browser with pdfmake and embedded Source Sans Pro (Latin subset), on US Letter with 1 inch margins, a "Page X of Y" footer, Section 9 and the appendix starting on new pages, and shaded answer paragraphs. The report body has no tables.

Keep the JSON file in agency storage. Do not put resident data in it. The questions ask about the AI system, not about a person's case file.

The Agency Lead email, if you enter one, stays in the JSON file and is left out of the report.

## What the report covers

Ten sections, in the same order as the current report writer:

1. Summary
2. Purpose of this assessment
3. The AI system and inventory record
4. Why this AI system is High-risk
5. Findings by criterion (C1–C12, then recommended practice RP1–RP8)
6. Risks and recommended mitigations
7. Agency Follow-Up
8. Inventory summary (b7)
9. Agency Lead acknowledgment
10. Sources

An appendix lists Q1–Q25 with the answers as selected. A blank prints "No answer provided."

Citations are the published statute (Md. Code SF&P §§ 3.5-801, 803, 804, 805) and the published Responsible AI Policy and Implementation Guidance, tagged [P1] and [P2], plus the other published sources listed in Section 10. ISO/IEC 42001 and ISO/IEC 27090 are cited by clause number only.

Unknown counts as a Gap (or Not yet for recommended practice). A group with no access path shown is Partial. Mitigations are capped at 3, including one Ongoing item, when no C4–C12 item is Gap and no recommended-practice item is Not yet.

## How DoIT edits questions, rules and templates

Edit the data modules, not the page layout, unless the layout is what you mean to change.

| What | File |
| --- | --- |
| Version numbers | `src/content/types.ts` |
| Statement sets (32 items) | `src/content/statements.ts` |
| Gates, mitigations, fixed paragraphs, sources, proposed-rule list | `src/content/rules.ts` |
| Option lists | `src/content/catalog.ts` |
| Form fields, help text, show/hide | `src/content/form.ts` |
| Which rule is still a proposal | `content/RULES.md` and `proposed: true` in the modules |
| Finding sentences (What we found) | `content/findings.json` |
| Report assembly | `src/engine/report.ts` |
| Word and PDF layout tokens | `src/report/style.ts` |
| Scoring | `src/engine/evaluate.ts` |

Published index of statement codes, statuses and mitigations: `content/rules-index.json`. Regenerate it with `npm run rules-index` after a content edit.

Bump `RULES_VERSION` when a rule or statement changes. Old answer files still open. The report names the version it used.

## Run it locally

```bash
npm ci
npm test
npm run dev
```

Open the URL Vite prints (http://localhost:5173). `npm run build` writes the static site to `dist/`. `npm run preview` serves that folder.

## Tests

- `npm test` runs the engine unit tests and checks synthetic scenarios S01–S24.
- `npm run validate` rewrites `docs/scenario-validation.md`.
- `npm run rules-index` rewrites `content/rules-index.json`.
- With `npm run preview` already running, `npm run smoke` drives Chrome through the example assessment, the draft report and the Word download. It needs Chrome and `puppeteer-core`.

The scenario answers are coded conversions of the prose scenarios. They are fictional and labeled example data. On the checks this version runs (required gates, forbidden gates, deadline date, prohibited-use flag, prior-deployment fact, status conflict, mitigation count range), all 24 match. Three scenarios also set an extra gate the key treats as arguable or possible: S06 adds G1, S12 adds G1, S24 adds G4. Those notes are in the validation file. They are not counted as failures.

The conversion does not reproduce every sentence of a Claude report. Statuses inside a "good" scenario are the strongest statement, except where a scenario override says otherwise.

## GitHub Pages

The workflow `.github/workflows/pages.yml` runs tests on pull requests and deploys `dist/` to GitHub Pages on a push to `main`.

The repository owner has to turn Pages on once:

1. GitHub → this repository → Settings → Pages.
2. Build and deployment → Source: **GitHub Actions**.

After the first green deploy on `main`, the site is at `https://dexcopeland.github.io/AIA-Reports-Testing/`.

Asset paths are relative, so the same build works at that project URL and on a local preview.

## Stack

Vite and TypeScript, with no UI framework. The form uses native controls (labels, fieldsets, radios, checkboxes). The Word file is built in the browser with the `docx` library. Source Sans Pro is bundled from Fontsource (SIL Open Font License).

## Remaining work

See [ROADMAP.md](ROADMAP.md). GitHub Issues could not be created from this environment (the available GitHub tools are read-only), so the follow-up list lives in that file.
