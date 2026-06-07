import type { NextConfig } from "next";

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.BUILD_ID ??
  "dev";

const nextConfig: NextConfig = {
  // pdf-parse / pdfjs-dist embarquent un « worker » que le bundler serveur de
  // Next ne sait pas résoudre (« Cannot find module pdf.worker.mjs »). On les
  // externalise pour qu'ils soient chargés depuis node_modules à l'exécution.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  generateBuildId: async () => buildId,
  async redirects() {
    return [
      // Anciens slugs locator → outil unifié /outils/bureaux
      { source: "/outils/localiser-onem", destination: "/outils/bureaux", permanent: true },
      { source: "/outils/trouver-un-bureau-onem", destination: "/outils/bureaux", permanent: true },
      { source: "/outils/organisme-de-paiement", destination: "/outils/bureaux", permanent: true },
    ];
  },
};

export default nextConfig;
