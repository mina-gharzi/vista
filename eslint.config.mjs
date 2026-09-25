import js from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";
import tseslint from "typescript-eslint";
import globals from "globals";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "**/*.config.js",
    ],
  },

  { linterOptions: { reportUnusedDisableDirectives: "off" } },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // --- قوانین TypeScript پروژه (بخش ۱۸ پرامپت مادر) ---
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error", // @ts-ignore / @ts-nocheck ممنوع
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-assertions": [
        "warn",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // --- Backend / Shared ---
  {
    files: ["backend/**/*.ts", "shared/**/*.ts", "*.mjs"],
    languageOptions: { globals: globals.node },
  },

  // --- Frontend ---
  {
    files: ["frontend/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: {
      // افزونه Next 14 هنوز با API جدید ESLint 9 سازگار نیست؛ fixupPluginRules آن را Wrap می‌کند
      "@next/next": fixupPluginRules(nextPlugin),
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    ...jsxA11y.flatConfigs.recommended,
    files: ["frontend/**/*.{ts,tsx}"],
  },
);
