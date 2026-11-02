import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBluf } from "../src/engine/bluf";
import { evaluate } from "../src/engine/evaluate";
import { EXAMPLES, EXAMPLE_GROUP_LABELS } from "../src/examples/catalog";
import { buildExample } from "../src/examples/build";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "examples");

function openCount(file: ReturnType<typeof buildExample>): number {
  const result = evaluate(file);
  const open = (status: string) => status === "Gap" || status === "Partial" || status === "Not yet" || status === "Partly in place";
  return [...result.criteria, ...result.rp].filter((item) => open(item.status)).length;
}

async function main(): Promise<void> {
  await mkdir(root, { recursive: true });
  const groups = (["state", "vendor"] as const).map((id) => ({
    id,
    label: EXAMPLE_GROUP_LABELS[id],
    examples: EXAMPLES.filter((spec) => spec.group === id).map((spec) => ({
      id: spec.id,
      title: spec.title,
      description: spec.description,
      file: `${spec.id}.json`,
    })),
  }));
  await writeFile(join(root, "index.json"), `${JSON.stringify({ groups }, null, 2)}\n`);
  for (const spec of EXAMPLES) {
    const file = buildExample(spec);
    await writeFile(join(root, `${spec.id}.json`), `${JSON.stringify(file, null, 2)}\n`);
    const result = evaluate(file);
    const bluf = buildBluf(result);
    const statuses = [...result.criteria, ...result.rp].map((item) => `${item.id}:${item.status}`).join(" ");
    console.log(`${spec.id}\tfindings=${openCount(file)}\tsteps=${bluf.steps.length}\t${bluf.sentences[0]}`);
    console.log(`  ${bluf.sentences[2]}`);
    console.log(`  ${statuses}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
