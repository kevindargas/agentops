import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-config-next already registers the jsx-a11y plugin with a small
    // rule subset; layer the full recommended rule set on top of it.
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Base UI composes via `render={<a />}` / `render={<h2 />}`: the element's
      // content comes from the parent's children, which this rule cannot see.
      "jsx-a11y/anchor-has-content": "off",
      "jsx-a11y/heading-has-content": "off",
      // Only used for initial focus inside dialogs and side panels, which the
      // WAI-ARIA dialog pattern recommends.
      "jsx-a11y/no-autofocus": "off",
    },
  },
  {
    // shadcn primitives: labels and groups are composed by callers.
    files: ["components/ui/**"],
    rules: {
      "jsx-a11y/label-has-associated-control": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
  {
    // Vendored shadcn AI Elements registry code: keep upstream intact, relax
    // the strict React Compiler rules and Next.js image rule for these files.
    files: ["components/ai-elements/**"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
