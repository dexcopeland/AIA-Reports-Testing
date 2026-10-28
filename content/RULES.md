# Rules used by the in-browser AIA

Finding sentences live in `content/findings.json` (`findings_version`). Each criterion and recommended-practice check has one template per status. The engine fills `{{detail}}`, `{{areas}}`, and `{{situation}}`. It does not paste the agency's statement into "What we found."

Versions in `src/content/types.ts`:

- Schema version `1.0.0` (answers files)
- Form version `v2-structured-1.0.0`
- Rules version `1.2.0`

The engine reads the TypeScript modules in `src/content/`. Those modules are the versioned questions, statement sets, mitigations and fixed report paragraphs. Change them in git. The report footer records the rules version and a content fingerprint of the answers.

The engine order is:

1. Check the answers file schema and form version.
2. Resolve each visible statement (unknown, evidence check, target date, design-fact relevance).
3. Set the prohibited-use flag. The report still runs. There is no approval line.
4. Set the area, gates G1–G7 and the speech line.
5. Set the data level, suggested minimum level, overlays and privacy track.
6. Roll criteria and recommended-practice checks up to the weakest status.
7. Set the § 3.5-803(e) deadline from Q18 when a vendor or outside model is involved. A system built by the State, with no vendor and no outside model, does not use Q18. Set the prior-deployment fact from Q17 and Q19.
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
| threat-fit | Q22 shows only threats that fit the Q6 answers. The mapping below is proposed. A hidden threat is excluded because of those answers. |

The prohibited-use checklist in v1 has two examples named in the current writer rules (covert or real-time biometric identification without consent, and social scoring), plus none and unknown. It is not the full published Prohibited Uses list.

## Question branching

Saved answers for a hidden field stay in the JSON file. The engine ignores them, the same way it ignores vendor answers when Q5 is built by the State.

### Q18 procurement

Q18 is hidden when Q5 is "Built by the State, with no outside model or vendor." Procurement is not applicable. A saved Q18 value is ignored, including an older "Before 1 Feb 2026" answer, so it cannot set 1 July 2027.

The report does not print a procurement-date line and does not print the no-date sentence ("The § 3.5-803(e) deadline depends on the procurement date"). No statutory date is invented. The deadline line names the deployment status and the start date, which are the facts the timing rules already use (Before use when the system is in pilot or live, Before deployment when it is not). An outside model still asks Q18. Choosing "Built by the State" on that visible question still uses the no-date sentence.

### Q19 start and prior assessment

Q19 is shown only when Q17 is Pilot or Live. For Planning or Procuring, the prior assessment is Not applicable and no start date is asked. The saved values stay in the file.

A start date saved on an older file while Q17 is Planning or Procuring still sets the status-conflict flag. The form no longer offers a way to type that date. The loaded value is what keeps the flag working.

### Q15 processing place

Q15 starts as a yes/no question: "Is the data processed in the same place it runs (the Q6 hosting answer)?" The control defaults to Yes. Yes uses the Q6 value. No shows the hosting radio, and the engine uses that answer.

An older file that has `q15_where` and no `q15_same_place` still loads. The saved place is kept and used until the person answers the new question. If that place differs from Q6, the yes/no is left unanswered and the saved place stays on screen, so choosing Yes is a real change.

### Q22 threat fit (proposed)

Show a threat only when it fits Q6. If capabilities are Unknown or empty, show every threat. If the fit is unclear, keep the threat visible. A hidden threat counts as not applicable in RP5. The report says it was excluded because of the Q6 answers, not because the agency selected Does not apply. A saved statement for that threat stays in the file and is ignored.

| Threat | Shown when | Hidden when |
| --- | --- | --- |
| Prompt injection | Q6 includes writes or drafts text, chats with the public, or pulls documents into answers. Also shown when the method is a large language model, another method, Unknown, or blank. | A known non-generative capability set, such as ranks or classifies only, with a statistical or rules-plus-model method. |
| Poisoned training or reference data | The system may be trained or fine-tuned on agency data: a large language model or an unclear method, a generative, chat, or retrieval capability, or a visible vendor-training answer of allowed. A saved answer is ignored when Q5 is built by the State and that question is hidden. Also shown when capabilities are Unknown or empty. | A statistical or rules-plus-model system whose design facts say all inputs are public, with no generative, chat, or retrieval capability, and no visible vendor permission to train on State data. |
| Model theft or copying | Always, including vendor cloud, a State data center, an agency network, and staff devices. Hosting does not by itself show that the agency holds the weights. | Not hidden. The fit is unclear for every hosting answer. |
| Data leaking through outputs | Always. This statement is about outputs, which is broader than leakage through prompts. | Not hidden. Limiting it to generative systems would drop cases whose fit is unclear. |
| Unsafe outputs passed to other systems | Q6 says the output is sent to other systems, or that design fact is not ticked. If both are true, it stays visible. | The design fact "Its output is not passed to any other system" is ticked, and Q6 does not say the output is sent to other systems. |
