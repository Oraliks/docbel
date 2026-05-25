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
});

export const KnowledgeSourceUpdateSchema = KnowledgeSourceCreateSchema.partial();

/**
 * Schéma du body POST /api/chomage-ia/chat.
 * `sessionId` optionnel : si absent, on crée une nouvelle session.
 */
export const ChatRequestSchema = z.object({
  sessionId: z.string().min(1).max(50).optional(),
  message: z.string().min(1, "Message vide").max(4000),
  domain: z.string().min(2).max(50).optional().default(DEFAULT_DOMAIN),
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
}
