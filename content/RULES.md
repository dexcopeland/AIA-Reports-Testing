# Rules used by the in-browser AIA

Versions in `src/content/types.ts`:

- Schema version `1.0.0` (answers files)
- Form version `v2-structured-1.0.0`
- Rules version `1.0.0`

The engine reads the TypeScript modules in `src/content/`. Those modules are the versioned questions, statement sets, mitigations and fixed report paragraphs. Change them in git. The report footer records the rules version and a content fingerprint of the answers.

The engine order is:

1. Check the answers file schema and form version.
2. Resolve each visible statement (unknown, evidence check, target date, design-fact relevance).
3. Set the prohibited-use flag. The report still runs. There is no approval line.
4. Set the area, gates G1–G7 and the speech line.
5. Set the data level, suggested minimum level, overlays and privacy track.
6. Roll criteria and recommended-practice checks up to the weakest status.
7. Set the § 3.5-803(e) deadline from Q18, and the prior-deployment fact from Q17 and Q19.
8. Collect mitigations, drop encryption when it is already met, keep one Ongoing item, and cap the list at 3 when no C4–C12 item is Gap and no recommended-practice item is Not yet.
9. Merge follow-ups to one block per question number. Never Q25.
10. Keep up to 5 confirm-the-facts lines.
11. Fill the 10 sections and the question-and-answer appendix.
12. Run the mechanical checks (banned words, timings, one Ongoing item, no email, word count on the inventory summary).

Unknown counts as Gap for criteria and Not yet for recommended practice, except the access-path items 12d and 12e, where an unknown answer is Partial.

## Proposed rules

These are marked `proposed: true` in the content modules. They need DoIT sign-off. The app uses them so the draft can run. They are not signed policy.

| ID | Rule |
| --- | --- |
| statement-wording | All 32 statement sets, and the status and mitigation on each line, are proposals. |
| evidence-check | Blank or token evidence on a strongest line (under 5 words, or a token such as yes, done, or see above) drops that item to Partial or Partly in place. This is not a fact check. |
| evidence-required-split | Evidence is required for a Met criterion item and optional for an In place recommended-practice item. |
| retention | Retention (15d) is a proposed data item. Unknown raises a follow-up and does not by itself add a mitigation. |
| q18-unknown | Q18 includes Unknown. Blank or Unknown uses the no-date sentence and a Q18 follow-up. |
| g4-decides | G4 applies when Q10 is decides, unless every output is reviewed before it takes effect. Sample review, late review and no review also set G4. |
| g4-cross-check | Q6 "sends output to other systems" plus Q10 "information only" sets G4 when every output is not reviewed first. |
| g6 | G6 is record matching plus an area where the match can lead to action. |
| biometric-combo | Biometric identification plus the identifying-people area raises the prohibited-use flag even if the checklist says none. |
| export-gate | Word and print stay off until Q25 is confirmed. The on-screen draft still renders. |
| cap-priority | The cap of 3 keeps a prohibited-use or abuse-risk item first, then a path for a group that uses the system or is acted on as individuals, then other partial items by earliest timing, plus Ongoing. |
| status-conflict | A start date while Q17 is Planning or Procuring uses Before use timing until the agency confirms the status. |
| outside-people | Q12 "no" plus a Q9 group other than State employees makes notice and challenge a Gap. |
| level-cross-check | Q14 can suggest a higher data level than Q13. The report says so and does not change Q13. |

The prohibited-use checklist in v1 has two examples named in the current writer rules (covert or real-time biometric identification without consent, and social scoring), plus none and unknown. It is not the full published Prohibited Uses list.
