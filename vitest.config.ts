import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    // Le secret NRN n'a plus de repli hardcodé (SECURITY_QUEUE S1) : on fournit
    // un secret factice aux tests purs de crypto-nrn / dedupe.
    env: {
      BOOKING_NRN_SECRET: "vitest-nrn-secret-not-for-prod",
      // Secret factice pour les tests du token d'aperçu page-builder
      // (preview-token lit BETTER_AUTH_SECRET au chargement du module).
      BETTER_AUTH_SECRET: "vitest-preview-secret-not-for-prod",
    },
    include: [
      "lib/**/__tests__/**/*.test.ts",
      "lib/**/*.test.ts",
      "components/**/__tests__/**/*.test.ts",
    ],
    globals: true,
    // Les tests sur vrais PDF (fillForm sur un document ~200 Ko) dépassent le
    // défaut de 5s sous charge (CI, machine partagée) alors qu'ils sont verts
    // isolément — cf. docs/superpowers/plans/2026-08-01-suites-audit-pdf-forms.md S2.
    testTimeout: 15_000,
  },
});
