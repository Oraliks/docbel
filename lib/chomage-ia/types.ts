/**
 * Types partagés pour le module Assistant IA Chômage.
 *
 * Définit les "kinds" autorisés des sources, les valeurs par défaut et
 * les schémas Zod réutilisés côté API et UI.
 */

import { z } from "zod";

/**
 * Liste finie des types de sources qu'on accepte dans la knowledge base.
 * Si on ajoute un kind, mettre à jour KIND_LABELS dans `_shared.tsx` aussi.
 */
export const KNOWLEDGE_SOURCE_KINDS = [
  "text",
  "url",
  "tutorial",
  "video_transcript",
  "image_caption",
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "qa",
] as const;

export type KnowledgeSourceKind = (typeof KNOWLEDGE_SOURCE_KINDS)[number];

/**
 * Domaine par défaut — extensible plus tard (fiscalité, sécu sociale…).
 */
export const DEFAULT_DOMAIN = "chomage";

/**
 * Schéma de création / mise à jour d'une source.
 * `content` est obligatoire car c'est ce que l'IA va lire.
 */
export const KnowledgeSourceCreateSchema = z.object({
  title: z.string().min(2, "Titre trop court").max(200),
  kind: z.enum(KNOWLEDGE_SOURCE_KINDS),
  content: z.string().min(10, "Contenu trop court").max(200_000),
  summary: z.string().max(2000).optional().nullable(),
  sourceUrl: z.string().url("URL invalide").max(2000).optional().nullable(),
  fileId: z.string().max(50).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  enabled: z.boolean().optional().default(true),
  domain: z.string().min(2).max(50).optional().default(DEFAULT_DOMAIN),
  /** Migration 21 — dossier optionnel (null = racine). */
  folderId: z.string().min(1).max(50).nullable().optional(),
});

export const KnowledgeSourceUpdateSchema = KnowledgeSourceCreateSchema.partial();

/**
 * Schéma du body POST /api/chomage-ia/chat.
 * `sessionId` optionnel : si absent, on crée une nouvelle session.
 * `enableWebSearch` (migration 22 — Feature 5) : si true, le backend déclenche
 * une recherche Brave AVANT d'appeler Claude et injecte les résultats comme
 * sources temporaires. Toggle UI explicite, jamais automatique.
 */
export const ChatRequestSchema = z.object({
  sessionId: z.string().min(1).max(50).optional(),
  message: z.string().min(1, "Message vide").max(4000),
  domain: z.string().min(2).max(50).optional().default(DEFAULT_DOMAIN),
  enableWebSearch: z.boolean().optional().default(false),
});

/**
 * Schéma du body POST /api/chomage-ia/prompt-builder.
 */
export const PromptBuilderRequestSchema = z.object({
  brief: z.string().min(5, "Brief trop court").max(2000),
  contextHint: z.string().max(500).optional(),
  domain: z.string().min(2).max(50).optional().default(DEFAULT_DOMAIN),
});

/**
 * Forme légère des sources renvoyées au client (sans le `content` complet
 * pour économiser la bande passante — il sera requêté à la demande).
 */
export interface KnowledgeSourceListItem {
  id: string;
  title: string;
  kind: string;
  summary: string | null;
  sourceUrl: string | null;
  fileId: string | null;
  tags: string[];
  enabled: boolean;
  domain: string;
  createdAt: string;
  updatedAt: string;
  contentPreview: string;
  contentLength: number;
  /** ISO timestamp du dernier indexing RAG, ou null. Migration 19. */
  indexedAt: string | null;
  /** Dernier message d'erreur d'indexing, ou null. Migration 19. */
  indexError: string | null;
  /** Migration 21 — dossier de classement (null = racine "Sans dossier"). */
  folderId: string | null;
  /** Migration 22 — statut de fraîcheur (fresh / stale / obsolete / unknown). */
  validityStatus: "fresh" | "stale" | "obsolete" | "unknown";
  /** Migration 22 — ISO du dernier "Toujours en vigueur" cliqué par l'admin. */
  lastValidatedAt: string | null;
}

/**
 * Migration 21 — dossier de classement hiérarchique pour les KnowledgeSource.
 *
 * Hiérarchie limitée à 3 niveaux (racine = niveau 1). La profondeur est
 * validée côté API à chaque mutation (POST / PATCH), pas en DB.
 */
export interface KnowledgeFolderListItem {
  id: string;
  name: string;
  /** Hex (#3b82f6) ou nom Tailwind ("blue"). Front décide du rendu. */
  color: string | null;
  /** Nom d'icône lucide (ex. "Folder", "BookOpen"). Défaut "Folder" si null. */
  icon: string | null;
  parentId: string | null;
  order: number;
  domain: string;
  /** Nombre de sources directement contenues dans ce folder (pas récursif). */
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Profondeur max autorisée pour l'arborescence des KnowledgeFolder.
 * Racine = niveau 1. Donc parentId.parentId.parentId === null obligatoire.
 *
 * Validé côté API (lib/chomage-ia/folders.ts) à chaque mutation de parentId.
 */
export const KNOWLEDGE_FOLDER_MAX_DEPTH = 3;

/* ------------------------------------------------------------------ */
/*  Migration 22 — Memory / Gaps / Ingestion                           */
/* ------------------------------------------------------------------ */

/** Importances autorisées pour une ChatMemory. */
export const MEMORY_IMPORTANCES = ["high", "medium", "low"] as const;
export type MemoryImportance = (typeof MEMORY_IMPORTANCES)[number];

export const ChatMemoryCreateSchema = z.object({
  content: z.string().min(3, "Contenu trop court").max(2000),
  importance: z.enum(MEMORY_IMPORTANCES).optional().default("medium"),
  enabled: z.boolean().optional().default(true),
  domain: z.string().min(2).max(50).optional().default(DEFAULT_DOMAIN),
});
export const ChatMemoryUpdateSchema = ChatMemoryCreateSchema.partial();

export interface ChatMemoryListItem {
  id: string;
  content: string;
  importance: MemoryImportance;
  enabled: boolean;
  domain: string;
  createdAt: string;
  updatedAt: string;
}

/** Statuts d'un gap de connaissance. */
export const KNOWLEDGE_GAP_STATUSES = ["open", "resolved", "ignored"] as const;
export type KnowledgeGapStatus = (typeof KNOWLEDGE_GAP_STATUSES)[number];

export const KnowledgeGapUpdateSchema = z.object({
  status: z.enum(KNOWLEDGE_GAP_STATUSES).optional(),
  notes: z.string().max(2000).optional().nullable(),
  knowledgeSourceId: z.string().max(50).optional().nullable(),
});

export interface KnowledgeGapListItem {
  id: string;
  query: string;
  detectedAt: string;
  sessionId: string | null;
  messageId: string | null;
  status: KnowledgeGapStatus;
  resolvedBy: string | null;
  knowledgeSourceId: string | null;
  notes: string | null;
  occurrences: number;
  domain: string;
}

/** Statut de fraîcheur d'une KnowledgeSource (Feature 3). */
export const SOURCE_VALIDITY_STATUSES = [
  "fresh",
  "stale",
  "obsolete",
  "unknown",
] as const;
export type SourceValidityStatus = (typeof SOURCE_VALIDITY_STATUSES)[number];

/** Kinds d'une source de veille. */
export const INGESTION_KINDS = ["rss", "scrape"] as const;
export type IngestionKind = (typeof INGESTION_KINDS)[number];
export const INGESTION_SCHEDULES = ["hourly", "daily", "weekly"] as const;
export type IngestionSchedule = (typeof INGESTION_SCHEDULES)[number];

export const IngestionSourceCreateSchema = z.object({
  name: z.string().min(2).max(120),
  kind: z.enum(INGESTION_KINDS),
  url: z.string().url("URL invalide").max(2000),
  schedule: z.enum(INGESTION_SCHEDULES).optional().default("daily"),
  enabled: z.boolean().optional().default(true),
  domain: z.string().min(2).max(50).optional().default(DEFAULT_DOMAIN),
});
export const IngestionSourceUpdateSchema = IngestionSourceCreateSchema.partial();

export interface IngestionSourceListItem {
  id: string;
  name: string;
  kind: IngestionKind;
  url: string;
  schedule: IngestionSchedule;
  enabled: boolean;
  domain: string;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  pendingCount: number;
}

export interface IngestedDocumentListItem {
  id: string;
  ingestionSourceId: string;
  ingestionSourceName: string;
  externalUrl: string;
  title: string;
  publishedAt: string | null;
  fetchedAt: string;
  status: "pending" | "validated" | "rejected";
  knowledgeSourceId: string | null;
  notes: string | null;
}

/** Body de création d'une source depuis une Q&A validée (Feature 2). */
export const SourceFromQaSchema = z.object({
  chatMessageId: z.string().min(1).max(50),
  title: z.string().min(2).max(200),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  folderId: z.string().min(1).max(50).nullable().optional(),
  notes: z.string().max(4000).optional().nullable(),
});

/** Body de requête web search (Feature 5). */
export const WebSearchRequestSchema = z.object({
  query: z.string().min(2).max(500),
  count: z.number().int().min(1).max(5).optional().default(3),
});
