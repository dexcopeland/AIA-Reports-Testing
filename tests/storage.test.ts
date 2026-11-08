import { afterEach, describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../src/content/types";
import { autosave, autoload, clearAutosave, emptyFile } from "../src/ui/storage";

/** The tests run in node, where there is no real localStorage. */
type FakeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function fakeStorage(
  options: {
    stored?: string | null;
    failGet?: boolean;
    failSet?: boolean;
    failRemove?: boolean;
  } = {},
): { store: FakeStorage; writes: string[] } {
  const { stored = null, failGet = false, failSet = false, failRemove = false } = options;
  const writes: string[] = [];
  const store: FakeStorage = {
    getItem() {
      if (failGet) throw new Error("storage access denied");
      return stored;
    },
    setItem(_key: string, value: string) {
      if (failSet) throw new Error("storage quota reached");
      writes.push(value);
    },
    removeItem() {
      if (failRemove) throw new Error("storage access denied");
    },
  };
  return { store, writes };
}

const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "localStorage", original);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});

function install(store: FakeStorage): void {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });
}

describe("draft storage", () => {
  it("autosave writes exactly the draft it is given", () => {
    const { store, writes } = fakeStorage();
    install(store);
    const file = emptyFile();
    file.answers.q4_name = "Department of Example";

    expect(autosave(file)).toBe(true);
    expect(JSON.parse(writes[0]!)).toEqual(file);
  });

  it("autosave reports, and survives, a browser that will not keep drafts", () => {
    const { store } = fakeStorage({ failSet: true });
    install(store);

    expect(() => autosave(emptyFile())).not.toThrow();
    expect(autosave(emptyFile())).toBe(false);
  });

  it("autoload answers a denied read with no file, and throws nothing", () => {
    const { store } = fakeStorage({ failGet: true });
    install(store);

    expect(autoload()).toBe(null);
  });

  it("autoload reads a kept draft back into a normalized file", () => {
    const file = emptyFile();
    file.answers.q4_name = "Department of Example";
    const { store } = fakeStorage({ stored: JSON.stringify(file) });
    install(store);

    const loaded = autoload();
    expect(loaded).not.toBe(null);
    expect(loaded?.schema_version).toBe(SCHEMA_VERSION);
    expect(loaded?.answers.q4_name).toBe("Department of Example");
  });

  it("clearAutosave survives a denied remove", () => {
    const { store } = fakeStorage({ failRemove: true });
    install(store);

    expect(() => clearAutosave()).not.toThrow();
  });
});
