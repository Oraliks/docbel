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
    // Project-specific ignores:
    ".claude/**",
    ".codex/**",
    "node_modules/**",
    "prisma/migrations/**",
    "components/ui/**", // shadcn auto-generated, edit at your own risk
    "scripts/seed-files.ts",
    "public/**", // static assets (pdf.worker.min.mjs, svg, etc.)
  ]),
]);

export default eslintConfig;
