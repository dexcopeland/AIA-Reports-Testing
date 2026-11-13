# Contributing

Thanks for your interest in this tool. It drafts Algorithmic Impact Assessments (AIAs) for Maryland state agencies. The code is MIT-licensed, so you are welcome to use it, adapt it for another agency or jurisdiction, and send changes back. If you only use the tool, start with the [user guide](docs/user-guide.md).

## Ground rules

- Do not put resident data in examples, tests, screenshots, or documentation. Keep example agencies and systems fictional, and keep the example label on those drafts.
- The tool states which rules are proposals rather than State policy. Keep that labeling accurate when you change rules. The proposed list is in [`content/RULES.md`](content/RULES.md).
- Edit the data modules when you mean to change questions, rules, or report text. Edit the page layout only when the layout is the change.

## Getting set up

You need Node.js 20 or newer. Continuous integration (CI) uses Node.js 22.

```bash
npm ci
npm test
npm run dev
```

Open the address Vite prints, [http://localhost:5173](http://localhost:5173). `npm run build` typechecks and writes the static site to `dist/`. `npm run preview` serves that folder.

## Scripts

| Script                 | What it does                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`          | Starts the local site on port 5173.                                                                                                          |
| `npm run build`        | Typechecks, then writes `dist/`.                                                                                                             |
| `npm run preview`      | Serves `dist/`.                                                                                                                              |
| `npm test`             | Runs the unit tests and the screen tests.                                                                                                    |
| `npm run lint`         | Runs ESLint on the TypeScript and React sources.                                                                                             |
| `npm run format`       | Rewrites files with Prettier. Print width is 100.                                                                                            |
| `npm run format:check` | Checks Prettier without rewriting.                                                                                                           |
| `npm run typecheck`    | Runs the TypeScript compiler without emitting files.                                                                                         |
| `npm run validate`     | Rewrites [`docs/scenario-validation.md`](docs/scenario-validation.md).                                                                       |
| `npm run rules-index`  | Rewrites [`content/rules-index.json`](content/rules-index.json).                                                                             |
| `npm run examples`     | Rewrites `examples/` from [`src/examples/catalog.ts`](src/examples/catalog.ts).                                                              |
| `npm run smoke`        | Drives Chrome through an example, the draft report, and the zip download. Run `npm run preview` first. It needs Chrome and `puppeteer-core`. |

CI runs lint, the format check, tests, the three generators, and the build on every push and pull request.

## Tests

`npm test` covers scoring, the path, the BLUF, the zip package, storage, and the screens in jsdom. The screen tests include autosave, the failed-save notice, continuing with blanks, restoring the browser copy, and the sign-off edits.

[`docs/scenario-validation.md`](docs/scenario-validation.md) compares synthetic scenarios S01–S24 with their keys. On the checks that file lists, 24 of 24 match. S06, S12, and S24 also set an extra gate the key treats as arguable or possible. Those notes are not failures. The scenarios are fictional.

## Generated content

Three committed files are generated. CI regenerates each one and fails if the committed copy differs.

| Command               | File that must match          |
| --------------------- | ----------------------------- |
| `npm run validate`    | `docs/scenario-validation.md` |
| `npm run rules-index` | `content/rules-index.json`    |
| `npm run examples`    | `examples/`                   |

Prettier ignores those generated files. After a content edit, run the matching command and commit the result.

## Project structure

`content/` holds the versioned content data: the proposed-rules document, the finding sentences, and the generated rules index. The engine reads the TypeScript modules in `src/content/`.

| What                                                                 | File                                      |
| -------------------------------------------------------------------- | ----------------------------------------- |
| Version numbers                                                      | `src/content/types.ts`                    |
| Statement sets (32)                                                  | `src/content/statements.ts`               |
| Gates, mitigations, fixed paragraphs, sources, prohibited uses       | `src/content/rules.ts`                    |
| Option lists, including certificates                                 | `src/content/catalog.ts`                  |
| Form fields, help text, show and hide, High versus General questions | `src/content/form.ts`                     |
| Proposed rules                                                       | `content/RULES.md`                        |
| Finding sentences                                                    | `content/findings.json`                   |
| Path from the gate facts                                             | `src/engine/path.ts`                      |
| Certificate credit                                                   | `src/engine/credits.ts`                   |
| Scoring                                                              | `src/engine/evaluate.ts`                  |
| BLUF sentences                                                       | `src/engine/bluf.ts`                      |
| Report assembly                                                      | `src/engine/report.ts`                    |
| Zip package                                                          | `src/report/zip.ts`                       |
| Word and PDF layout                                                  | `src/report/style.ts`                     |
| Screens, rail, save, and zip actions                                 | `src/ui/`                                 |
| Example drafts                                                       | `src/examples/catalog.ts` and `examples/` |

The page is a client-side questionnaire with a JSON save file and deterministic scoring, in the shape of Canada's [AIA tool](https://github.com/canada-ca/aia-eia-js). The output is the four-document package described in the [user guide](docs/user-guide.md).

## Versions

Current versions in `src/content/types.ts`:

- Schema `1.0.0`. An answers file with the same major version still opens.
- Form `v2-structured-1.0.0`.
- Rules `1.2.1`.

Bump `RULES_VERSION` when a rule or statement changes. Loading a file stamps it with the current rules version. The Executive Summary shows a response ID. It does not print the rules version. If the answers have no response id, the id is `DRAFT-` plus a fingerprint of the answers. That fingerprint lets you compare two runs of the same file. It is not a seal.

Unknown counts as a gap for a criterion, and as not yet for recommended practice. The access-path items 12d and 12e are the exception: unknown there is Partial. The answer "There is no path that fits this group" is also Partial. The mitigation list is capped at 3, including one Ongoing item, when no C4–C12 item is Gap and no recommended-practice item is Not yet. The cap and the other proposed rules are described in [`content/RULES.md`](content/RULES.md).

## Report stack

Word files ask for Times New Roman. That font is not in this repository. PDFs embed Liberation Serif, under the SIL Open Font License, from `src/fonts/`. Characters that font lacks are drawn from DejaVu Serif, under the Bitstream Vera license in the same folder. The zip is built in the browser with `fflate`, loaded only when someone downloads a package.

## Screens

The screens use React, Vite, TypeScript, and shadcn/ui with Tailwind. The palette is Maryland navy. The UI font is Source Sans Pro. Scoring and report assembly stay in framework-free modules.

## Examples

`examples/index.json` lists 14 fictional drafts in three groups: **Built by the State**, **A vendor product**, and **Path examples**. Each title starts with the path the answers produce: `High-risk:`, `General Impact Assessment:`, or `Prohibited:`. The dropdown loads those JSON files.

`npm run examples` rewrites the folder from `src/examples/catalog.ts`. The screen tests expect those path labels.

The screenshots in `docs/images/` illustrate the [user guide](docs/user-guide.md). They were taken from the local app with the fictional Benefits Eligibility Triage example. Retake them when the screen layout changes.

## How to change questions and rules

1. Edit the module in the table above. Leave the layout alone unless the layout is the change.
2. Bump `RULES_VERSION` when a rule or statement changes.
3. Run `npm test`, `npm run lint`, and `npm run format:check`.
4. If you changed content a generator owns, run `npm run validate`, `npm run rules-index`, or `npm run examples`, and commit the generated file.
5. Open a pull request.

## Deployment

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs the checks above on pull requests. On a push to `main`, it deploys `dist/` to GitHub Pages.

The live site is [https://dexcopeland.github.io/ai-impact-assessment-state-of-maryland/](https://dexcopeland.github.io/ai-impact-assessment-state-of-maryland/).

For a new copy of the repository, turn Pages on once:

1. GitHub, this repository, Settings, Pages.
2. Build and deployment, Source: **GitHub Actions**.

Asset paths are relative (`base: "./"` in `vite.config.ts`), so the same build works at that project URL and on a local preview.

## Licensing

- The code, documentation, and generated content in this repository are released under the [MIT license](LICENSE). You may use, copy, modify, and redistribute the tool, including in your own agency's copy or fork.
- Contributions are accepted under the same MIT license. By opening a pull request, you agree that your contribution is licensed to this project and to anyone who uses it under those terms.
- The fonts in `src/fonts/` are third-party assets under their own licenses: Liberation Serif under the SIL Open Font License (`LiberationSerif-LICENSE.txt`) and DejaVu Serif under the Bitstream Vera license (`DejaVu-LICENSE.txt`). Keep those license files with the fonts when you copy or redistribute them.
- The rules the tool applies reference Maryland statutes and DoIT policy. Those sources remain the property of the State of Maryland; this repository only describes and implements checks against them.
