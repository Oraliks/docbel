"use client";

// Gating des traceurs derrière le consentement « mesure d'audience » (RGPD_QUEUE §1).
// Tant que `analyticsAllowed` est faux (pas de décision OU refus), RIEN n'est
// monté → aucun script Vercel, aucun beacon. L'état vient du cookie lu au
// serveur (initialConsent) → pas de tracker au 1er render avant consentement.

import { Analytics } from "@vercel/analytics/next";
import { PageViewBeacon } from "@/components/page-builder/page-view-beacon";
import { useConsent } from "@/components/cookie-consent/consent-provider";

/** Vercel Web Analytics, monté uniquement avec consentement audience. */
export function AnalyticsGate() {
  const { analyticsAllowed } = useConsent();
  if (!analyticsAllowed) return null;
  return <Analytics />;
}

/** Beacon page-views first-party, conditionné au consentement audience. */
export function ConsentedPageViewBeacon({ slug }: { slug: string }) {
  const { analyticsAllowed } = useConsent();
  if (!analyticsAllowed) return null;
  return <PageViewBeacon slug={slug} />;
}
