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
    },
    include: [
      "lib/**/__tests__/**/*.test.ts",
      "lib/**/*.test.ts",
      "components/**/__tests__/**/*.test.ts",
    ],
    globals: true,
  },
});
