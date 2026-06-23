import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { serializeCommission } from "@/lib/commissions";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";
import { getUserLocale } from "@/i18n/locale";
import { localizeRecords } from "@/lib/i18n/content";

// Cache CDN partagé réservé à la locale canonique FR. Les variantes traduites
// (NL/EN…) passent en `private` (jamais servies depuis un cache partagé), et
// `Vary: Cookie` empêche le CDN de servir l'entrée FR à un visiteur NL/EN
// (la locale vit dans le cookie BELDOC_LOCALE).
function jsonHeaders(locale: string) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control":
      locale === "fr"
        ? "public, s-maxage=300, stale-while-revalidate=86400"
        : "private, no-store",
    Vary: "Cookie",
  };
}

export const revalidate = 300;

export async function GET() {
  try {
    const [items, lastUpdated, locale] = await Promise.all([
      withDbRetry(() =>
        prisma.commissionParitaire.findMany({
          orderBy: [{ code: "asc" }],
        })
      ),
      getSetting(SETTING_KEYS.COMMISSIONS_LAST_UPDATED),
      getUserLocale(),
    ]);

    // Traductions contenu DB (NL/EN…), fallback FR, no-op si locale=fr.
    const localized = await localizeRecords(
      "CommissionParitaire",
      items,
      ["nom", "label"],
      locale,
    );

    return NextResponse.json(
      {
        count: localized.length,
        lastUpdated,
        items: localized.map(serializeCommission),
      },
      { headers: jsonHeaders(locale) }
    );
  } catch (error) {
    console.error("Error fetching commissions data:", error);
    return NextResponse.json(
      { error: "Failed to fetch commissions" },
      { status: 500 }
    );
  }
}
