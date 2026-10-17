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
    ".next-audit/**",
    ".vercel/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project-specific ignores:
    ".claude/**",
    ".codex/**",
    // Worktrees et journaux locaux sont des artefacts de l'environnement : ils
    // peuvent contenir une copie complète du dépôt et ne font pas partie du
    // périmètre de lint du checkout courant.
    ".worktrees/**",
    ".validation-logs/**",
    "node_modules/**",
    "prisma/migrations/**",
    "components/ui/**", // shadcn auto-generated, edit at your own risk
    "scripts/seed-files.ts",
  ]),
]);

export default eslintConfig;
