/// Schémas Zod pour les arbres d'orientation (Decision Builder).
/// Single source of truth : les types TS sont dérivés via `z.infer` dans `./types.ts`.
///
/// Forme du contenu JSON stocké dans `DecisionTree.draftContent` /
/// `DecisionTreeRevision.content` :
///
///   { version: 1, rootNodeId: string | null, nodes: Record<string, Node> }
///
/// Structure **plate par ID** (et non arborescence imbriquée) : permet la
/// réutilisation de sous-branches, les conditions cross-nœuds, un diff lisible
/// entre versions et un rendu graphe trivial. C'est la même approche que celle
/// déjà utilisée par `lib/bundles/conditions.ts` (références par `sourceTemplateId`).
///
/// Les conditions sur `option.conditions` / `result.conditions` réutilisent
/// directement le type `BundleCondition` (lib/bundles/conditions.ts) — un
/// moteur AND/OR récursif déjà testé (22 tests, 12 opérateurs).

import { z } from "zod";
import type {
  BundleCondition as LibBundleCondition,
  ConditionGroup as LibConditionGroup,
} from "@/lib/bundles/conditions";

// ---------------------------------------------------------------------------
// Réutilisation : BundleCondition (lib/bundles/conditions.ts)
//
// On ré-exprime le type en Zod pour validation runtime, MAIS on annote les
// schémas avec les types canoniques de `lib/bundles/conditions.ts` : ainsi
// `z.infer` rend EXACTEMENT ces types (et non une variante structurelle), ce
// qui permet de passer directement le résultat à `evaluateCondition` sans cast.
// ---------------------------------------------------------------------------

export const ConditionOpSchema = z.enum([
  "equals",
  "notEquals",
  "in",
  "notIn",
  "contains",
  "truthy",
  "falsy",
  "gt",
  "lt",
  "gte",
  "lte",
  "isEmpty",
  "isNotEmpty",
]);

const ConditionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

export const ConditionLeafSchema = z.object({
  type: z.literal("leaf"),
  sourceTemplateId: z.string().min(1),
  fieldId: z.string().min(1),
  op: ConditionOpSchema,
  value: ConditionValueSchema.optional(),
});

// Groupe AND/OR récursif — z.lazy() pour briser le cycle de type. Annoté avec
// le type canonique `LibConditionGroup` pour que `z.infer` coïncide.
export const ConditionGroupSchema: z.ZodType<LibConditionGroup> = z.lazy(() =>
  z.object({
    type: z.enum(["and", "or"]),
    rules: z.array(z.union([ConditionLeafSchema, ConditionGroupSchema])),
  }),
);

// Règle "feuille" V1 (legacy, sans discriminant `type`).
export const LegacyRuleSchema = z.object({
  sourceTemplateId: z.string().min(1),
  fieldId: z.string().min(1),
  op: ConditionOpSchema,
  value: ConditionValueSchema.optional(),
});

/// `BundleCondition` au sens de `lib/bundles/conditions.ts` :
/// - `null` → toujours requis (pas de condition)
/// - `LegacyRule[]` → format legacy V1 (ANDé implicite)
/// - `ConditionGroup` → format V2 (arbre récursif)
/// Annoté avec le type canonique pour que `z.infer` rende exactement
/// `LibBundleCondition` (assignable à `evaluateCondition`).
export const BundleConditionSchema: z.ZodType<LibBundleCondition> = z.union([
  z.null(),
  z.array(LegacyRuleSchema),
  ConditionGroupSchema,
]);

// ---------------------------------------------------------------------------
// Nœuds de l'arbre — discriminated union sur `type`
// ---------------------------------------------------------------------------

/// Niveau de correspondance affiché à l'utilisateur (badge sur le résultat).
export const MatchLevelSchema = z.enum(["recommande", "pertinent", "a_verifier"]);

/// Nœud "question" : pose une question, propose un ensemble d'options.
/// Les options sont elles-mêmes des nœuds (référencées par `optionIds`).
export const QuestionNodeSchema = z.object({
  type: z.literal("question"),
  id: z.string().min(1),
  /// Libellé de la question affiché à l'utilisateur.
  text: z.string().min(1),
  /// Texte d'aide optionnel (affiché sous la question).
  helpText: z.string().optional(),
  /// Icône facultative (nom Lucide ex. "Briefcase", "UserMinus").
  icon: z.string().optional(),
  /// Description courte (sous-titre) — surtout pour les questions racines.
  description: z.string().optional(),
  /// Liste des IDs d'options proposées (ordre préservé).
  optionIds: z.array(z.string().min(1)).min(1),
});

/// Nœud "option" : une réponse possible à une question. Pointe vers le nœud
/// suivant (question ou résultat). Une condition optionnelle permet de
/// router dynamiquement selon les réponses précédentes.
export const OptionNodeSchema = z.object({
  type: z.literal("option"),
  id: z.string().min(1),
  /// Libellé de l'option (texte du bouton).
  label: z.string().min(1),
  /// Texte d'aide optionnel.
  helpText: z.string().optional(),
  /// Conditions de visibilité/activation (réutilise BundleCondition).
  conditions: BundleConditionSchema.optional(),
  /// ID du nœud suivant (question ou result). Validé par `validator.ts`.
  nextId: z.string().min(1),
});

/// Nœud "result" : feuille de l'arbre. Pointe vers un DocumentBundle.
/// `bundleSlug = null` signifie "bientôt disponible" (résultat sans dossier prêt).
export const ResultNodeSchema = z.object({
  type: z.literal("result"),
  id: z.string().min(1),
  /// Slug du DocumentBundle ciblé. `null` = pas de dossier (bientôt disponible).
  bundleSlug: z.string().min(1).nullable(),
  /// Titre du résultat affiché à l'utilisateur.
  title: z.string().min(1),
  /// Explication "pourquoi ce dossier" (markdown léger autorisé).
  rationale: z.string().min(1),
  /// Niveau de correspondance (badge). Default = "recommande".
  matchLevel: MatchLevelSchema.default("recommande"),
  /// Si `true`, affiche le bloc d'estimation d'allocation (cf wizard public).
  allocationEstimate: z.boolean().optional(),
  /// Slugs de dossiers proches (cartes secondaires). Fusionnés à l'affichage
  /// avec `DocumentBundle.relatedBundles`.
  related: z.array(z.string().min(1)).optional(),
  /// Conditions optionnelles pour filtrer les résultats applicables.
  conditions: BundleConditionSchema.optional(),
});

/// Union discriminée de tous les types de nœuds.
export const DecisionNodeSchema = z.discriminatedUnion("type", [
  QuestionNodeSchema,
  OptionNodeSchema,
  ResultNodeSchema,
]);

// ---------------------------------------------------------------------------
// Contenu complet d'un arbre (stocké dans `DecisionTree.draftContent` /
// `DecisionTreeRevision.content`).
// ---------------------------------------------------------------------------

/// Version de schéma du contenu. Incrémentée si forme JSON évolue de façon
/// non rétro-compatible (parser devra alors migrer V1 → V2 etc.).
export const CONTENT_VERSION = 1 as const;

export const DecisionTreeContentSchema = z.object({
  version: z.literal(CONTENT_VERSION),
  /// ID du nœud racine. `null` = arbre vide (non publiable).
  rootNodeId: z.string().min(1).nullable(),
  /// Tous les nœuds (questions / options / results) indexés par leur ID.
  nodes: z.record(z.string().min(1), DecisionNodeSchema),
});

/// Forme initiale d'un arbre vide (utilisée comme default DB + reset admin).
export function emptyTreeContent(): z.infer<typeof DecisionTreeContentSchema> {
  return { version: CONTENT_VERSION, rootNodeId: null, nodes: {} };
}

/// Parse + valide. Lève `ZodError` si invalide. Utilisé par les routes API.
export function parseTreeContent(
  input: unknown,
): z.infer<typeof DecisionTreeContentSchema> {
  return DecisionTreeContentSchema.parse(input);
}

/// Parse sans lever : retourne `null` si invalide. Utilisé par le loader runtime
/// public (fallback silencieux sur le TS si l'arbre DB est corrompu).
export function safeParseTreeContent(
  input: unknown,
): z.infer<typeof DecisionTreeContentSchema> | null {
  const r = DecisionTreeContentSchema.safeParse(input);
  return r.success ? r.data : null;
}

// ---------------------------------------------------------------------------
// Réponses utilisateur (stockées dans `BundleRun.orientationAnswers`).
//
// Forme : { [nodeId]: { value: string | string[] } }
// Le `value` est l'ID (string) d'une option choisie, ou un tableau d'IDs pour
// les questions multi-sélect (futur — V1 mono-sélect uniquement).
// ---------------------------------------------------------------------------

export const OrientationAnswerSchema = z.object({
  value: z.union([z.string(), z.array(z.string())]),
});

export const OrientationAnswersSchema = z.record(
  z.string().min(1),
  OrientationAnswerSchema,
);
