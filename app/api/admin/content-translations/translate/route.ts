import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { hasAnthropicKey } from "@/lib/chomage-ia/anthropic";
import { translateTexts, isTranslatableLocale } from "@/lib/i18n/translate";
import {
  getSourceTexts,
  sourceKey,
  type SourceItem,
} from "@/lib/i18n/content-source";

const json = { "Content-Type": "application/json; charset=utf-8" };

/**
 * POST — (re)traduit par IA une liste de lignes ContentTranslation.
 * Body : { ids: string[], force?: boolean }
 *   - ids    : lignes à traduire (la source FR est résolue côté serveur)
 *   - force  : si true, retraduit aussi les lignes "reviewed"/"published"
 *              (sinon on les protège : seules "ia" / vides sont retraduites)
 * Résultat → status:"ia", origin:"ia", + entrée d'historique. Le FR reste fallback.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  if (!hasAnthropicKey()) {
    return NextResponse.json(
      { error: "Clé IA non configurée (ANTHROPIC_API_KEY)." },
      { status: 503, headers: json }
    );
  }

  const editor = auth.user.email || auth.user.id;

  let body: { ids?: unknown; force?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  const force = body.force === true;
  if (ids.length === 0) {
    return NextResponse.json({ error: "Aucune ligne fournie" }, { status: 400, headers: json });
  }
  if (ids.length > 200) {
    return NextResponse.json(
      { error: "Trop de lignes (max 200 par appel)." },
      { status: 400, headers: json }
    );
  }

  // 1. Charge les lignes ciblées.
  const rows = await withDbRetry(() =>
    prisma.contentTranslation.findMany({ where: { id: { in: ids } } })
  );

  // 2. Filtre : protège reviewed/published sauf force.
  const protectedStatuses = new Set(["reviewed", "published"]);
  const eligible = rows.filter(
    (r) => isTranslatableLocale(r.locale) && (force || !protectedStatuses.has(r.status))
  );
  const skipped = rows.length - eligible.length;

  if (eligible.length === 0) {
    return NextResponse.json(
      { translated: 0, skipped, failed: 0, message: "Rien à traduire (lignes protégées ?)" },
      { headers: json }
    );
  }

  // 3. Résout les sources FR (helper corrigé pour la casse PascalCase).
  const items: SourceItem[] = eligible.map((r) => ({
    model: r.model,
    recordId: r.recordId,
    field: r.field,
  }));
  const sources = await getSourceTexts(items);

  // 4. Groupe par locale (1 appel IA par locale).
  const byLocale = new Map<string, typeof eligible>();
  for (const r of eligible) {
    if (!byLocale.has(r.locale)) byLocale.set(r.locale, []);
    byLocale.get(r.locale)!.push(r);
  }

  let translated = 0;
  let failed = 0;

  for (const [locale, localeRows] of byLocale) {
    const fr = localeRows.map(
      (r) => sources.get(sourceKey(r.model, r.recordId, r.field)) ?? ""
    );

    let translations: string[];
    try {
      translations = await translateTexts(fr, locale);
    } catch (e) {
      console.error(`translate ${locale} — échec`, e);
      failed += localeRows.length;
      continue;
    }

    // 5. Écrit chaque ligne traduite + historique (transaction par ligne).
    for (let i = 0; i < localeRows.length; i++) {
      const r = localeRows[i];
      const newValue = translations[i];
      if (!newValue || !newValue.trim() || newValue === r.value) {
        // source FR vide, IA muette, ou identique → on ne touche pas.
        if (!fr[i].trim()) failed += 0; // source vide = non traduisible, pas un échec
        continue;
      }
      try {
        await withDbRetry(() =>
          prisma.$transaction([
            prisma.contentTranslation.update({
              where: { id: r.id },
              data: { value: newValue, status: "ia", origin: "ia", updatedBy: editor },
            }),
            prisma.contentTranslationHistory.create({
              data: {
                translationId: r.id,
                oldValue: r.value,
                newValue,
                oldStatus: r.status,
                newStatus: "ia",
                origin: "ia",
                editedBy: editor,
              },
            }),
          ])
        );
        translated++;
      } catch (e) {
        console.error(`persist translation ${r.id}`, e);
        failed++;
      }
    }
  }

  return NextResponse.json({ translated, skipped, failed }, { headers: json });
}
