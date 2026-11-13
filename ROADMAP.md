# Roadmap after v1

Open follow-up work is tracked in this file. The labels below are suggestions for when issues are opened in [dexcopeland/ai-impact-assessment-state-of-maryland](https://github.com/dexcopeland/ai-impact-assessment-state-of-maryland).

## Statement wording review

**Suggested label:** `content`

All 32 statement sets in `src/content/statements.ts` are proposals (`proposed: true`). DoIT AI Governance still needs to sign off on the wording, the status on each line, and the mitigation each line triggers. See `content/RULES.md`.

## Full prohibited-use list

**Suggested label:** `content`

Encoded in rules version 1.2.1. Q7 lists the five Prohibited Uses from the Responsible AI Policy, Version 1.0, Date Issued 05/23/25, section Prohibited Uses (https://doit.maryland.gov/policies/ai/Pages/maryland-responsible-ai-policy.aspx), plus None of these and Unknown. The biometric-combo blocker was removed. It is not one of those published purposes. Biometric identification or individual ranking still sets High when the output is a basis for a decision or action.

## Proposed rules needing sign-off

**Suggested label:** `rules`

Every row in `content/RULES.md` is in force in v1 and still marked proposed. That includes the evidence check, retention (15d), the Q18 Unknown option, the G4 and G6 mappings, the cap-of-3 priority, the status-conflict timing, the outside-people cross-check, the data-level cross-check, the Q25 export block, and the Q22 threat-fit mapping.

## Remaining template paragraphs

**Suggested label:** `content`

v1 uses a small set of slot paragraphs (what we found, risk line, action, follow-up). The feasibility note estimated a much larger approved paragraph library, with a distinct sentence for each status and statement. Replace the generic sentences in `src/engine/report.ts` as those paragraphs are approved. Keep ISO citations to clause numbers only.

## Intake and submission path to DoIT

**Suggested label:** `process`

The site sends nothing to DoIT. The feasibility note's preferred path is still open: a short intake form that takes the reference, the system name and the answers JSON, with the agency also able to email the JSON to the governance mailbox. Re-rendering from the JSON with this same engine should be the record copy, because a downloaded Word file can be edited.

## Accessibility audit

**Suggested label:** `a11y`

A code-level audit with automated evidence is in [`docs/accessibility-audit.md`](docs/accessibility-audit.md): a keyboard-only smoke pass covers every section, save, and both downloads, tests pin the Word heading styles, and the skip link and question-card headings were fixed. What remains is the human screen-reader pass with NVDA on Chrome, following the checklist in that document — statement sets, the group-relation questions, the error summary on Continue, and focus after a section change.

## Scenario divergences and fuller scoring

**Suggested label:** `tests`

`docs/scenario-validation.md` records S01–S24 against gates, deadline, prohibited use, prior deployment, status conflict and mitigation counts. Extra gates that the keys allow:

- S06 also sets G1 (the key calls G1 arguable).
- S12 also sets G1 (tickets coded with money or legal rights).
- S24 also sets G4 (the key says G4 is possible).

Not yet compared: full C1–C12 and RP1–RP8 status against each key, follow-up question text, and mitigation wording. The coded answers are conversions of the prose, not a second human's reading of every sentence. A reviewer should log any prose answer that fits no statement cleanly.

## Dev-dependency advisories

**Suggested label:** `maintenance`

`npm audit` reports advisories in the Vitest toolchain (`tinypool`, `@vitest/mocker`). Those packages are not part of the Pages bundle. Upgrade the test runner when a release clears them.

## Other follow-ups

**Suggested label:** `later`

- Cryptographic hash in the footer. v1 uses a content fingerprint so two runs of the same file can be compared. It is not a seal.
- Serve older rules versions at fixed paths when the form changes, with a migration map for old answer files.
- A second reviewer pass on the S01–S24 conversions before anyone treats the match table as an evaluation of the earlier drafting workflow.
