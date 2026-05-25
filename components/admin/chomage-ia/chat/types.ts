/**
 * Types client partagés entre les composants de chat.
 */

export interface ChatSessionItem {
  id: string;
  title: string;
  domain: string;
  /** Migration 17 — épinglée en haut du rail. */
  pinned: boolean;
  /** Migration 17 — sortie de la liste principale. */
  archived: boolean;
  /** Migration 17 — dossier de groupement (null = hors-dossier). */
  folderId: string | null;
  /** Migration 18 — modèle Claude forcé pour cette session (null = défaut Sonnet). */
  preferredModel: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/**
 * Modèles Claude exposés à la UI pour le sélecteur par session.
 * Doit rester aligné avec `CLAUDE_MODELS` de `lib/chomage-ia/models.ts`
 * et `ALLOWED_MODELS` côté API `PATCH /sessions/[id]`.
 */
export const CHAT_MODEL_OPTIONS = [
  {
    value: "claude-sonnet-4-5-20250929",
    short: "S",
    label: "Sonnet 4.5",
    tagline: "Qualité — raisonnement long, citations multi-sources",
    /** Couleur du badge dans le rail (Tailwind utility classes). */
    badgeClass:
      "bg-violet-500/20 text-violet-800 dark:text-violet-200 ring-violet-500/40",
    pricePerMsg: "≈ $0.02 / msg",
  },
  {
    value: "claude-haiku-4-5-20251001",
    short: "H",
    label: "Haiku 4.5",
    tagline: "Rapide — réponses courtes, faible coût",
    badgeClass:
      "bg-cyan-500/20 text-cyan-800 dark:text-cyan-200 ring-cyan-500/40",
    pricePerMsg: "≈ $0.001 / msg",
  },
] as const;

export type ChatModelValue = (typeof CHAT_MODEL_OPTIONS)[number]["value"];

/**
 * Retourne l'option correspondant à un `preferredModel` stocké (ou null
 * pour le défaut auto = Sonnet sans bouton "forcé").
 */
export function findChatModelOption(
  value: string | null | undefined
): (typeof CHAT_MODEL_OPTIONS)[number] | null {
  if (!value) return null;
  return CHAT_MODEL_OPTIONS.find((o) => o.value === value) ?? null;
}

/**
 * Helper court pour afficher le nom du modèle dans un badge / tooltip.
 * - `null` ou inconnu → "Auto" (= Sonnet par défaut).
 */
export function getModelShortName(
  value: string | null | undefined
): "Sonnet" | "Haiku" | "Auto" {
  if (!value) return "Auto";
  if (value === "claude-sonnet-4-5-20250929") return "Sonnet";
  if (value === "claude-haiku-4-5-20251001") return "Haiku";
  return "Auto";
}

/**
 * Dossier de groupement coloré pour ranger les sessions (migration 17).
 */
export interface ChatFolderItem {
  id: string;
  name: string;
  color: string | null;
  order: number;
  domain: string;
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Message dans le thread. `kind` (optionnel, défaut "chat") permet d'afficher
 * un rendu spécial pour les prompts générés inline (mode `generated_prompt`).
 * Les prompts générés ne sont PAS persistés comme ChatMessage en DB — ils sont
 * sauvegardés via /api/chomage-ia/prompts (GeneratedPrompt). Ils n'apparaissent
 * que dans la session courante côté UI.
 */
export interface ChatMessageItem {
  id?: string;
  role: "user" | "assistant";
  content: string;
  citedSourceIds: string[];
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  createdAt?: string;
  /** Marker local : true tant qu'aucun token n'est encore arrivé (affichage du PendingIndicator).
   *  - Mode non-streaming : reste à true jusqu'à la réponse complète.
   *  - Mode streaming : passe à false dès le 1er `text_delta` (laisse `streaming=true`). */
  pending?: boolean;
  /** Marker local : true tant que le stream SSE n'est pas terminé (deltas + meta + done).
   *  Différent de `pending` : ici on a déjà du texte qui s'affiche, mais l'appel n'est pas
   *  terminé. Permet d'afficher le bouton Stop et le badge "live" sur la bulle. */
  streaming?: boolean;
  /** Timestamp (ms) du début de la requête — sert au timer live + à la
   *  durée totale persistée dans `elapsedMs` une fois la réponse arrivée. */
  pendingStartedAt?: number;
  /** Durée totale de l'appel IA en millisecondes (côté client uniquement). */
  elapsedMs?: number;
  /** Type de bulle. "chat" (par défaut) = bulle markdown normale.
   *  "generated_prompt" = bulle spéciale avec block code + bouton "Copier" prominent. */
  kind?: "chat" | "generated_prompt";
  /** Pour kind="generated_prompt" : id de l'entrée GeneratedPrompt persistée. */
  promptId?: string;
  /** Pour kind="generated_prompt" : brief d'origine (affiché dans la bulle). */
  promptBrief?: string;
  /** Pour kind="generated_prompt" : titre court généré par Claude. */
  promptTitle?: string;
  /** Marker local : true si la réponse streaming a été interrompue par l'utilisateur (Stop). */
  aborted?: boolean;
}

/**
 * Événements SSE reçus du backend pendant un stream chat / regenerate.
 * Wire format : `data: {<JSON>}\n\n`.
 */
export type ChatStreamEvent =
  | { type: "text_delta"; text: string }
  | {
      type: "meta";
      sessionId: string;
      messageId: string;
      createdAt: string;
      citedSourceIds: string[];
      citedSources: CitedSourceLite[];
      missingSources: string[];
      usage: {
        inputTokens: number | null;
        outputTokens: number | null;
        cacheReadTokens: number | null;
        cacheWriteTokens: number | null;
        model: string;
        stopReason: string | null;
      } | null;
      kbStats: {
        totalSourcesAvailable: number;
        includedInContext: number;
        truncated: boolean;
      };
    }
  | { type: "done" }
  | { type: "error"; message: string };

export interface CitedSourceLite {
  id: string;
  title: string;
  kind: string;
  sourceUrl: string | null;
  summary: string | null;
}
