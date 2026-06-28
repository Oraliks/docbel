import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.BUILD_ID ??
  "dev";

const isProd = process.env.NODE_ENV === "production";

// CSP démarrée en **report-only** (SECURITY_QUEUE S2) : on observe les violations
// sans rien bloquer, le temps de durcir. `'unsafe-inline'`/`'unsafe-eval'` sont
// tolérés car Next injecte des scripts inline (hydratation + script thème dans
// app/layout.tsx) et le HMR de dev utilise eval ; à resserrer via nonces ensuite.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https:",
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
].join("; ");

// Permissions-Policy : on coupe les capteurs sensibles. geolocation reste
// autorisée en same-origin pour le localisateur de bureaux (/outils/bureaux).
const permissionsPolicy = [
  "camera=()",
  "microphone=()",
  "payment=()",
  "usb=()",
  "browsing-topics=()",
  "geolocation=(self)",
].join(", ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: permissionsPolicy },
  // HSTS uniquement en prod (HTTPS) pour ne pas piéger le dev en http://localhost.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // Anciens slugs locator → outil unifié /outils/bureaux
      { source: "/outils/localiser-onem", destination: "/outils/bureaux", permanent: true },
      { source: "/outils/trouver-un-bureau-onem", destination: "/outils/bureaux", permanent: true },
      { source: "/outils/organisme-de-paiement", destination: "/outils/bureaux", permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
