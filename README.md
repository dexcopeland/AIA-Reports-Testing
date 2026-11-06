# Maryland Algorithmic Impact Assessment (browser draft)

This is a no-AI, in-browser Algorithmic Impact Assessment for Maryland state agencies. An agency answers a structured form. The page builds a draft report with fixed rules. Nothing is sent to a server.

Agency draft — not approval. Send DoIT the signed Executive Summary.

It follows the shape of Canada's [AIA tool](https://github.com/canada-ca/aia-eia-js): a client-side questionnaire, a JSON file you can save and load, and deterministic scoring. The output here is a written 10-section report, not only a score.

## What an agency does

1. Open the GitHub Pages site (or run it locally).
2. Start a new assessment, continue a saved draft, or load an example. The example list has ten fictional drafts, grouped as **Built by the State** and **A vendor product**. Each one is a saved-draft JSON file. The report is scored from those answers.
3. Answer section by section. Later questions appear only when they apply. Statement sets run from weakest to strongest, plus "We don't know / not determined yet." A planned line asks for a target date. The strongest line can ask for one line of evidence.
4. The browser saves the draft on this computer. Use **Save JSON file** to download a copy. The file includes `schema_version`, `form_version` and `rules_version`.
5. Read the on-screen draft. In the executive summary, record each mitigation acknowledgment (Yes or No), pick each date from the calendar, and type comments. Type the Agency Lead's name and date. The signature line stays blank. Those entries are saved in the draft JSON. After Q25 is confirmed, download a report package (.zip). The zip holds four PDFs and the same four documents as Word files: Executive Summary, Evidence, Assessment Submission Record, and Follow-Up Actions. Files are named from the system, for example `Benefits-Eligibility-Triage-fictional-1-Executive-Summary.pdf`. The Word files use Times New Roman. Each PDF embeds Liberation Serif (metric-compatible, SIL Open Font License) and uses DejaVu Serif for characters Liberation Serif does not have. If a character is in neither font, the download says so and names the question. Each PDF is US Letter. The header names the system and the document. The footer names the date and "Page X of Y". The narrative is prose. Empty dates, comments, the name, and the title stay blank fillable fields. A comment that was typed is wrapped, and its box grows instead of cutting the text off. The signature stays a signature field.

Keep the JSON file in agency storage. Do not put resident data in it. The questions ask about the AI system, not about a person's case file.

The Agency Lead email, if you enter one, stays in the JSON file and is left out of the report.

## What the report covers

The download is four documents.

1. **Executive Summary.** System info, the bottom line up front, what is in place, where there is room for improvement, and the risks with recommended mitigations in plain language. Each item names the Evidence section it comes from. The mitigation acknowledgments, dates, comments, and the Agency Lead sign-off are here.
2. **Evidence.** Every gate and criteria check: what was checked, the result, and the answers that drove it.
3. **Assessment Submission Record.** Every question and the agency's answer, in order, with the system name and submission date.
4. **Follow-Up Actions.** The numbered follow-up steps, one sentence each, with the owner and due date when the assessment has them. Each step names the Evidence section.

The bottom line states the outcome, the High-risk level, and the single most important reason in a few plain sentences, then lists follow-up steps. If nothing needs follow-up, the report says so in one sentence.

A blank answer prints "No answer provided."

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
| Example drafts | `examples/*.json` and `examples/index.json` |
| Report assembly | `src/engine/report.ts` |
| Report package zip | `src/report/zip.ts` |
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
- With `npm run preview` already running, `npm run smoke` drives Chrome through an example assessment, the draft report and the Word download. It needs Chrome and `puppeteer-core`.
- `npm run examples` rewrites `examples/` from `src/examples/catalog.ts`. The dropdown loads those JSON files.

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

Vite, TypeScript, and React. The screens use shadcn/ui (Tailwind) themed with the Maryland navy palette and Source Sans Pro. Scoring, branching, and report assembly stay in framework-free modules. The Word files are built in the browser with the `docx` library and ask for Times New Roman. The PDFs embed Liberation Serif (SIL Open Font License, in `src/fonts/`) and use DejaVu Serif, under the Bitstream Vera license in that same folder, when Liberation Serif has no glyph. Times New Roman itself is not included in this repository. The zip is built in the browser with `fflate`, loaded only when a report package is downloaded, so GitHub Pages does not need a server.

## Remaining work

See [ROADMAP.md](ROADMAP.md). GitHub Issues could not be created from this environment (the available GitHub tools are read-only), so the follow-up list lives in that file.
