import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Casos de teste das regras Semgrep (código vulnerável de propósito).
    ".semgrep/**",
    // Biblioteca de terceiros já minificada (servida pela página offline).
    "public/vendor/**",
  ]),
  // Scripts Node em CommonJS (.js) usam require de propósito.
  { files: ["scripts/**/*.js"], rules: { "@typescript-eslint/no-require-imports": "off" } },
]);

export default eslintConfig;
