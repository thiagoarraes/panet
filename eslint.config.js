import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    ...reactPlugin.configs.flat.recommended,
    settings: {
      react: { version: "19.2" },
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // _err, _ e similares: variaveis intencionalmente ignoradas com prefixo _
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      // Regras novas do react-hooks v7 — adotar gradualmente
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-caught-error": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // preserve-caught-error tambem aparece sem prefixo no ESLint 10
      "preserve-caught-error": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
