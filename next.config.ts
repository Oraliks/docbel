import type { NextConfig } from "next";

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.BUILD_ID ??
  "dev";

const nextConfig: NextConfig = {
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
