# Maryland Algorithmic Impact Assessment

Use this tool to draft an Algorithmic Impact Assessment (AIA) for an artificial intelligence (AI) system at a Maryland state agency. You answer a form in your browser. The page writes the draft from your answers with fixed rules. Nothing is sent to a server.

The finished draft is a four-document package — Executive Summary, Evidence, Assessment Submission Record, and Follow-Up Actions — delivered in a zip as PDF and Word files.

Open the tool: [https://dexcopeland.github.io/ai-impact-assessment-state-of-maryland/](https://dexcopeland.github.io/ai-impact-assessment-state-of-maryland/)

Every screen shows this line: **Agency draft — not approval. Send DoIT the signed Executive Summary.** The package does not approve a system or authorize it to be bought, used, or deployed. The website does not send anything to DoIT. You send the signed Executive Summary.

## Documentation

| Document                                           | What it covers                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [User guide](docs/user-guide.md)                   | Using the tool end to end, and what to do with the report package it produces.                       |
| [Contributing](CONTRIBUTING.md)                    | Running the tool locally, changing questions and rules, tests and checks, licensing, and deployment. |
| [Roadmap](ROADMAP.md)                              | Open follow-up work after v1.                                                                        |
| [Proposed rules](content/RULES.md)                 | The rules the tool applies, and which are still proposals.                                           |
| [Scenario validation](docs/scenario-validation.md) | Synthetic scenarios S01–S24 checked against the engine.                                              |

## Development

You need Node.js 20 or newer. Continuous integration (CI) uses Node.js 22.

```bash
npm ci
npm test
npm run dev
```

Open the address Vite prints, [http://localhost:5173](http://localhost:5173). `npm run build` typechecks and writes the static site to `dist/`. `npm run preview` serves that folder.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the scripts, the generated content checks, the project structure, and how to change questions and rules.

## License

The code and documentation are released under the [MIT license](LICENSE).

The report fonts in `src/fonts/` keep their own licenses: Liberation Serif under the SIL Open Font License (`LiberationSerif-LICENSE.txt`), and DejaVu Serif under the Bitstream Vera license (`DejaVu-LICENSE.txt`).
