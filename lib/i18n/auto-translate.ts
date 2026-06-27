import "server-only";
import { after } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { hasAnthropicKey } from "@/lib/chomage-ia/anthropic";
import { translateTexts, isTranslatableLocale } from "./translate";
import {
  getSourceTexts,
  sourceKey,
  normalizeModel,
  SOURCE_FIELDS,
  type SourceItem,
} from "./content-source";

/**
 * Auto-traduction du contenu DB après une sauvegarde FR (Phase 2).
 *
 * Politique :
 *   - Cible les langues publiques NL + EN.
 *   - Statut "ia" + origin "ia" → validation manuelle (le FR reste fallback).
 *   - PROTÈGE ce qui a déjà été validé à la main : on ne réécrase JAMAIS une
 *     ligne "reviewed" ou "published". On (re)génère seulement les lignes
 *     manquantes ou encore "ia". → cohérent avec "à chaque save FR + validation
 *     manuelle" sans détruire le travail relu.
 *
 * Déclenchement : `scheduleAutoTranslate()` (fire-and-forget via `after()`),
 * appelé aux points de sauvegarde admin uniquement (jamais les seeds/compteurs).
 */

const AUTO_LOCALES = ["nl", "en"] as const;
const PROTECTED = new Set(["reviewed", "published"]);

/**
 * (Re)traduit les champs traduisibles d'un record vers NL + EN.
 * `model` = nom PascalCase tel que stocké ("News", "Bureau", …).
 * Best-effort : toute erreur est loguée, jamais propagée.
 */
export async function autoTranslateRecord(
  model: string,
  recordId: string
): Promise<void> {
  if (!hasAnthropicKey()) return; // pas de clé → no-op silencieux

  const camel = normalizeModel(model);
  const fields = SOURCE_FIELDS[camel];
  if (!fields || fields.length === 0) return;

  // 1. Sources FR de tous les champs traduisibles du record.
  const items: SourceItem[] = fields.map((f) => ({ model, recordId, field: f }));
  const sources = await getSourceTexts(items);

  // 2. Lignes de traduction déjà existantes (protection + historique).
  const existing = await withDbRetry(() =>
    prisma.contentTranslation.findMany({ where: { model, recordId } })
  );
  const existingMap = new Map(existing.map((r) => [`${r.field}:${r.locale}`, r]));

  for (const locale of AUTO_LOCALES) {
    if (!isTranslatableLocale(locale)) continue;

    // Champs à traduire : source FR non vide ET pas déjà validé à la main.
    const todo = fields.filter((f) => {
      const fr = sources.get(sourceKey(model, recordId, f)) ?? "";
      if (!fr.trim()) return false;
      const ex = existingMap.get(`${f}:${locale}`);
      return !ex || !PROTECTED.has(ex.status);
    });
    if (todo.length === 0) continue;

    const fr = todo.map((f) => sources.get(sourceKey(model, recordId, f)) ?? "");
    let translations: string[];
    try {
      translations = await translateTexts(fr, locale);
    } catch (e) {
      console.error(`autoTranslate ${model}/${recordId} ${locale} — échec IA`, e);
      continue;
    }

    for (let i = 0; i < todo.length; i++) {
      const field = todo[i];
      const value = translations[i];
      if (!value || !value.trim()) continue;
      const ex = existingMap.get(`${field}:${locale}`);
      if (ex && value === ex.value) continue; // inchangé → on n'écrit pas

      try {
        const saved = await withDbRetry(() =>
          prisma.contentTranslation.upsert({
            where: {
              model_recordId_field_locale: { model, recordId, field, locale },
            },
            create: {
              model,
              recordId,
              field,
              locale,
              value,
              status: "ia",
              origin: "ia",
              updatedBy: "ai:auto",
            },
            update: { value, status: "ia", origin: "ia", updatedBy: "ai:auto" },
          })
        );
        await withDbRetry(() =>
          prisma.contentTranslationHistory.create({
            data: {
              translationId: saved.id,
              oldValue: ex?.value ?? "",
              newValue: value,
              oldStatus: ex?.status ?? "ia",
              newStatus: "ia",
              origin: "ia",
              editedBy: "ai:auto",
            },
          })
        );
      } catch (e) {
        console.error(`autoTranslate persist ${model}/${recordId} ${field}/${locale}`, e);
      }
    }
  }
}

/**
 * Planifie une auto-traduction en arrière-plan (après l'envoi de la réponse).
 * À appeler depuis un route handler / server action, APRÈS un save FR réussi,
 * idéalement seulement si un champ traduisible a changé.
 * Hors contexte requête (script/seed) → no-op silencieux (jamais d'appel IA en masse).
 */
export function scheduleAutoTranslate(model: string, recordId: string): void {
  try {
    after(async () => {
      try {
        await autoTranslateRecord(model, recordId);
      } catch (e) {
        console.error("scheduleAutoTranslate", e);
      }
    });
  } catch {
    // `after()` hors d'un cycle requête (seed, script tsx) → on ignore.
  }
}

/** Champs traduisibles d'un modèle (helper pour garder les call-sites concis). */
export function translatableFields(model: string): readonly string[] {
  return SOURCE_FIELDS[normalizeModel(model)] ?? [];
}
