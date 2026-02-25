import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

/** @type {import('eslint').Linter.FlatConfig[]} */
const eslintConfig = [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      // Globals navigateur + Node.js pour éviter les faux positifs
      globals: {
        // Browser
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        alert: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        // Node.js
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        global: "readonly",
        // React 19 (JSX transform automatique, pas besoin d'importer React)
        React: "readonly",
        JSX: "readonly",
        // Next.js
        NextRequest: "readonly",
        NextResponse: "readonly",
        // Test (Vitest)
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        test: "readonly",
        // DOM types
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        HTMLDivElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLElement: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        Event: "readonly",
        EventTarget: "readonly",
        AbortController: "readonly",
        crypto: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // Règles utiles sans être trop strictes
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "no-console": "warn",
      "no-constant-binary-expression": "warn",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
    ],
  },
];

export default eslintConfig;
