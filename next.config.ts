import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  // experimental.optimizePackageImports désactivé temporairement —
  // suspect de faire boucler Turbopack sur la route /admin/pages/[pageId]
};

export default nextConfig;
