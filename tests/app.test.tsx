/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import indexJson from "../examples/index.json";
import { activeSections, sectionHeading } from "../src/content/form";
import { evaluate } from "../src/engine/evaluate";
import { type AnswerFile } from "../src/content/types";
import { AssessmentApp } from "../src/ui/AssessmentApp";
import { sectionStepLabel } from "../src/ui/form-model";
import { normalizeFile } from "../src/ui/storage";

// jsdom has no ResizeObserver; the sticky-header effect needs the constructor to exist.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

const exampleIndex = indexJson as {
  groups: { examples: { id: string; file: string }[] }[];
};

/** The same eager JSON modules the app itself uses to load example drafts. */
const exampleModules = import.meta.glob("../examples/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

interface LoadedExample {
  entry: { id: string; file: string };
  draft: AnswerFile;
  rawContent: unknown;
  mitigations: number;
}

/** Pick the first example that leaves mitigations open, so the report has acks to edit. */
function pickExampleWithAcks(): LoadedExample {
  for (const entry of exampleIndex.groups.flatMap((group) => group.examples)) {
    const key = Object.keys(exampleModules).find((item) => item.endsWith(`/${entry.file}`));
    if (!key) throw new Error(`Missing example file ${entry.file}.`);
    const rawContent = structuredClone(exampleModules[key]);
    const draft = normalizeFile(rawContent);
    const { mitigations } = evaluate(draft);
    if (mitigations.length > 0) {
      return { entry, draft, rawContent, mitigations: mitigations.length };
    }
  }
  throw new Error("No example carries unclosed mitigations.");
}

function storedDraft(): Record<string, unknown> {
  const raw = localStorage.getItem("md-aia-draft-v1");
  if (!raw) throw new Error("The browser copy is missing.");
  return JSON.parse(raw) as Record<string, unknown>;
}

const NAME_LABEL = "Name of the AI system (required)";

function buttonName(label: string): RegExp {
  return new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

/** The per-section headings, in the order the app shows them for this draft. */
function sectionNames(loaded: LoadedExample): string[] {
  return activeSections(loaded.draft.answers).map((section, index) =>
    sectionHeading(index, section.title),
  );
}

/** Step forward to a section. The first click on a blank section warns and stays; the second completes the advance. */
async function advanceTo(
  user: ReturnType<typeof userEvent.setup>,
  loaded: LoadedExample,
  target: number,
) {
  const names = sectionNames(loaded);
  for (let clicks = 0; clicks < names.length * 3; clicks++) {
    const headingName = screen.getByRole("heading", { level: 2 }).textContent ?? "";
    if (headingName === names[target]) return;
    if (!names.includes(headingName)) break;
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
  }
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(names[target]);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function uploadExample(user: ReturnType<typeof userEvent.setup>, loaded: LoadedExample) {
  await user.upload(
    screen.getByLabelText("Answers JSON file"),
    new File([JSON.stringify(loaded.rawContent)], loaded.entry.file, { type: "application/json" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { level: 2, name: "Section 1: About this request" }),
    ).toBeInTheDocument(),
  );
}

describe("AssessmentApp", () => {
  it("keeps every keystroke in the browser as the answers change", async () => {
    const user = userEvent.setup();
    const loaded = pickExampleWithAcks();
    render(<AssessmentApp />);
    await uploadExample(user, loaded);
    await advanceTo(user, loaded, 1);

    const name = screen.getByLabelText<HTMLInputElement>(NAME_LABEL);
    await user.type(name, "XZ");

    expect(JSON.parse(localStorage.getItem("md-aia-draft-v1")!).answers.q4_name).toBe(
      `${loaded.draft.answers["q4_name"]}XZ`,
    );
  });

  it("announces that the browser did not keep the draft and keeps the answers on screen", async () => {
    const denied: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
      getItem: () => null,
      setItem: () => {
        throw new Error("storage quota reached");
      },
      removeItem: () => undefined,
    };
    const native = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    if (native)
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: denied });
    try {
      const user = userEvent.setup();
      render(<AssessmentApp />);

      await user.click(screen.getByRole("button", { name: "Start a new assessment" }));
      await user.type(screen.getByLabelText("Agency (required)"), "Department of Example");

      expect(screen.getAllByText(/This browser did not keep that draft/).length).toBeGreaterThan(0);
      expect(screen.getByLabelText("Agency (required)")).toHaveValue("Department of Example");
    } finally {
      if (native) Object.defineProperty(globalThis, "localStorage", native);
    }
  });

  it("keeps the skip link, a focusable main, and heading-named question cards in the tree", async () => {
    const user = userEvent.setup();
    render(<AssessmentApp />);

    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");

    await user.click(screen.getByRole("button", { name: "Start a new assessment" }));
    const cardHeadings = screen.getAllByRole("heading", { level: 3, name: /Question \d+/ });
    expect(cardHeadings.length).toBeGreaterThan(0);
  });

  it("warns once with Still blank, then continues to the next section on the second Continue", async () => {
    const user = userEvent.setup();
    render(<AssessmentApp />);

    await user.click(screen.getByRole("button", { name: "Start a new assessment" }));
    expect(screen.getByRole("heading", { level: 2, name: /Section 1/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(screen.getByText("Still blank")).toBeInTheDocument();
    expect(screen.getByText(/A blank answer counts as a gap/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Section 1/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(screen.getByRole("heading", { level: 2, name: /Section 2/ })).toBeInTheDocument();
    expect(screen.queryByText("Still blank")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("offers the browser copy again after leaving, and restoring keeps the typed answers", async () => {
    const user = userEvent.setup();
    const loaded = pickExampleWithAcks();
    render(<AssessmentApp />);
    await uploadExample(user, loaded);
    await advanceTo(user, loaded, 1);
    await user.type(screen.getByLabelText(NAME_LABEL), "XZ");
    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(
      screen.getByRole("dialog", { name: "Save a draft before going home?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Leave without saving" }));
    expect(screen.getByRole("button", { name: "Continue saved draft" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue saved draft" }));
    await advanceTo(user, loaded, 1);
    expect(String((storedDraft().answers as Record<string, unknown>).q4_name).endsWith("XZ")).toBe(
      true,
    );
    expect(screen.getByLabelText<HTMLInputElement>(NAME_LABEL).value.endsWith("XZ")).toBe(true);
  });

  it("opens the draft report from a finished example and keeps the sign-off edits in the saved file", async () => {
    const user = userEvent.setup();
    const loaded = pickExampleWithAcks();
    render(<AssessmentApp />);
    await uploadExample(user, loaded);

    const sections = activeSections(loaded.draft.answers);
    const lastIndex = sections.length - 1;
    const stepLabel = sectionStepLabel(lastIndex, sections[lastIndex]!.title);
    await user.click(screen.getByRole("button", { name: buttonName(stepLabel) }));
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: sectionHeading(lastIndex, sections[lastIndex]!.title),
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review and create draft" }));

    expect(screen.getByRole("heading", { name: "Draft report" })).toBeInTheDocument();

    const yes = screen.getAllByRole<HTMLInputElement>("radio", { name: "Yes" });
    await user.click(yes[0]!);
    const signer = screen.getByLabelText("Name");
    await user.clear(signer);
    await user.type(signer, "Robin Wheeler");

    const stored = storedDraft() as unknown as {
      signoff?: { lead_name?: string; mitigations: { id: string; choice: string }[] };
    };
    expect(stored.signoff?.lead_name).toBe("Robin Wheeler");
    expect(stored.signoff?.mitigations.some((ack) => ack.choice === "yes")).toBe(true);
  });
});
