import { z } from "zod";

/**
 * Infos importantes contextuelles affichées dans le panneau d'aide d'un
 * formulaire PDF (`ContextHelpPanel`, colonne de gauche). Le contenu réagit à
 * ce que l'utilisateur coche (motif) ou à l'étape active.
 *
 * ── Module PUR (client-safe) ──────────────────────────────────────────────
 * Schéma Zod = source de vérité, défauts en code, parse résilient, résolution
 * pure. AUCUN accès prisma / next-cache ici (importable côté client :
 * `ContextHelpPanel`). Les lectures/écritures DB vivent dans
 * `lib/form-context-tips.server.ts` (`server-only`). Même découpage que
 * `site-settings.ts` (pur) vs `site-settings.server.ts` (serveur).
 *
 * Stocké sous UNE clé `AppSetting` (`form_context_tips`) contenant un objet
 * JSON validé Zod → zéro migration, défauts sûrs en code. L'édition admin
 * (CMS) override ces défauts (Lot 2).
 */

export const FORM_CONTEXT_TIPS_KEY = "form_context_tips";
export const FORM_CONTEXT_TIPS_CACHE_KEY = "form_context_tips";

// ---------------------------------------------------------------------------
// Schéma Zod
// ---------------------------------------------------------------------------

/// Texte localisé (fr/nl/de = le type Locale des formulaires PDF). FR
/// obligatoire ; nl/de retombent sur FR au rendu (cf. `pickLocalized`).
const localizedText = z.object({
  fr: z.string(),
  nl: z.string().optional(),
  de: z.string().optional(),
});
export type LocalizedText = z.infer<typeof localizedText>;

/// Condition d'affichage d'une entrée :
///  - `field-checked` : un motif coché (ex. `modificationAdresse`)
///  - `section`       : une étape/section active (ex. `identite`)
///  - `always`        : toujours affichée sur ce formulaire
const tipCondition = z.discriminatedUnion("type", [
  z.object({ type: z.literal("field-checked"), fieldId: z.string().min(1) }),
  z.object({ type: z.literal("section"), sectionKey: z.string().min(1) }),
  z.object({ type: z.literal("always") }),
]);
export type TipCondition = z.infer<typeof tipCondition>;

const tipEntrySchema = z.object({
  /// Id stable (clés React + édition admin).
  id: z.string().min(1),
  when: tipCondition,
  /// Pastille courte (ex. « Adresse »).
  eyebrow: localizedText.optional(),
  title: localizedText,
  /// Phrase d'intro sous le titre.
  intro: localizedText.optional(),
  /// Puces « infos importantes » (obligations / avertissements).
  reminders: z.array(localizedText),
  /// Puces « À vérifier / à préparer ».
  checklist: z.array(localizedText).optional(),
  /// Lien « En savoir plus » (masqué si `href` vide).
  link: z
    .object({ label: localizedText, href: z.string() })
    .optional(),
});
export type TipEntry = z.infer<typeof tipEntrySchema>;

export const formContextTipsSchema = z.record(
  z.string(),
  z.object({ entries: z.array(tipEntrySchema) }),
);
export type FormContextTips = z.infer<typeof formContextTipsSchema>;

// ---------------------------------------------------------------------------
// Défauts — source de vérité du contenu C1 (Lot 1)
// ---------------------------------------------------------------------------

/// Seul le bloc *adresse* du C1 changement-situation est seedé. Les autres
/// motifs et les sections retombent sur `section-help.ts` jusqu'à rédaction
/// par Oraliks (admin Lot 2). Aucun contenu légal inventé.
export const FORM_CONTEXT_TIPS_DEFAULTS: FormContextTips = {
  "c1-changement-situation": {
    entries: [
      {
        id: "c1-adresse",
        when: { type: "field-checked", fieldId: "modificationAdresse" },
        eyebrow: { fr: "Adresse" },
        title: { fr: "Changement d'adresse" },
        intro: { fr: "Vous avez indiqué un changement d'adresse. À garder en tête :" },
        reminders: [
          {
            fr: "Restez inscrit chez Actiris — c'est une obligation, même après votre déménagement.",
          },
          {
            fr: "Le changement prend effet dès que vous habitez réellement à la nouvelle adresse : n'attendez pas la validation de la commune, qui peut prendre plusieurs semaines.",
          },
        ],
        checklist: [
          { fr: "Date effective du déménagement" },
          { fr: "Nouvelle adresse complète" },
          { fr: "Commune / code postal" },
          { fr: "Composition du ménage si elle a changé" },
        ],
        // href vide = lien masqué (Oraliks fournira une URL réelle si besoin).
        link: { label: { fr: "En savoir plus" }, href: "" },
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Merge + parse (résilient : un JSON partiel/corrompu retombe sur les défauts)
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/// Deep-merge de `patch` sur `base` (objets simples ; arrays remplacés).
/// Aligné sur `deepMergeSettings` de `site-settings.ts`.
function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch === undefined ? base : (patch as T);
  }
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (k in base && isPlainObject((base as Record<string, unknown>)[k])) {
      out[k] = deepMerge((base as Record<string, unknown>)[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

/**
 * Fusionne un objet arbitraire sur les défauts puis valide. Retourne toujours
 * un `FormContextTips` complet : une structure invalide retombe intégralement
 * sur les défauts (jamais de throw, jamais de contenu vidé).
 */
export function parseFormContextTips(raw: unknown): FormContextTips {
  const merged = deepMerge(FORM_CONTEXT_TIPS_DEFAULTS, raw);
  const result = formContextTipsSchema.safeParse(merged);
  if (result.success) return result.data;
  return FORM_CONTEXT_TIPS_DEFAULTS;
}

/**
 * Fusionne un dictionnaire (patch) sur un dictionnaire de base — objets
 * fusionnés par slug, arrays (`entries`) remplacés. Utilisé à l'écriture pour
 * éviter qu'une sauvegarde à partir d'un état obsolète n'efface les
 * formulaires ajoutés entre-temps par un autre admin (cf. `setFormContextTips`,
 * même garde que `setSiteSettings`).
 */
export function mergeFormContextTips(
  base: FormContextTips,
  patch: unknown,
): FormContextTips {
  return deepMerge(base, patch);
}

// ---------------------------------------------------------------------------
// Résolution + dérivés (purs)
// ---------------------------------------------------------------------------

export interface TipResolutionContext {
  /// Clés des sections/étapes actives. Une macro-étape en regroupe plusieurs
  /// (ex. C1 « Activités & revenus » = mes-activites + mes-revenus) : on passe
  /// TOUTES les clés actives, pas seulement la première, sinon un conseil ciblé
  /// sur une section non-première ne s'afficherait jamais.
  sectionKeys: string[];
  /// Ids des champs booléens cochés (motifs) dans les réponses courantes.
  checkedFieldIds: string[];
}

/// Filtre les entrées à afficher pour un contexte donné, dans l'ordre de
/// déclaration (empilable si plusieurs conditions matchent).
export function resolveTips(entries: TipEntry[], ctx: TipResolutionContext): TipEntry[] {
  const checked = new Set(ctx.checkedFieldIds);
  const sections = new Set(ctx.sectionKeys);
  return entries.filter((e) => {
    switch (e.when.type) {
      case "always":
        return true;
      case "field-checked":
        return checked.has(e.when.fieldId);
      case "section":
        return sections.has(e.when.sectionKey);
    }
  });
}

/// Entrées par défaut (code) d'un formulaire — repli client quand aucune
/// donnée serveur (DB) n'a été fournie au panneau. `[]` si non documenté.
export function getDefaultTipsForForm(formSlug: string): TipEntry[] {
  return FORM_CONTEXT_TIPS_DEFAULTS[formSlug]?.entries ?? [];
}

/// Sélectionne le texte de la locale demandée, repli FR (contenu Belgique
/// fr/nl/de, comme `section-help.ts`).
export function pickLocalized(text: LocalizedText, locale: "fr" | "nl" | "de"): string {
  return text[locale] || text.fr;
}
