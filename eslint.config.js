import js from "@eslint/js";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/", "coverage/"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // App source: browser. Tooling and tests: node.
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: globals.browser },
  },
  {
    files: ["eslint.config.js", "vite.config.ts", "scripts/**/*.{ts,mjs}", "tests/**/*.ts"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: globals.node },
  },

  // Puppeteer script: it edits the page from Node code that also runs in the browser
  // via page.evaluate, so it needs both environments globals.
  {
    files: ["scripts/smoke-ui.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  // React source: hook correctness and fast-refresh friendliness.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["src/**/*.tsx"],
    plugins: { "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // Accessibility in the actual UI markup.
  jsxA11y.flatConfigs.recommended,

  // shadcn-generated components export variant builders alongside the component;
  // they are not screens, so the fast-refresh export rule does not apply to them.
  {
    files: ["src/components/ui/**"],
    rules: {
      "react-refresh/only-export-components": "off",
      // The wrapper receives { htmlFor } through { spread }; association happens at
      // the calling sites, which the rule still checks.
      "jsx-a11y/label-has-associated-control": "off",
    },
  },

  prettierConfig,
);
