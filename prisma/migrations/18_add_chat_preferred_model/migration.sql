-- Migration 18 — Chômage IA : sélection de modèle par session
--
-- Ajoute :
--   * Colonne `preferredModel` sur ChatSession (nullable).
--     - null      → utilise le défaut serveur (Sonnet 4.5).
--     - "claude-sonnet-4-5-20250929" → force Sonnet (qualité, ~$0.02/msg).
--     - "claude-haiku-4-5-20251001"  → force Haiku  (rapide, ~$0.001/msg).
--
-- Aucune donnée existante n'est altérée : la valeur par défaut est NULL,
-- ce qui correspond au comportement historique (Sonnet 4.5 hardcodé).
-- La validation des valeurs autorisées est faite côté API (PATCH /sessions/[id]).

ALTER TABLE "ChatSession" ADD COLUMN "preferredModel" TEXT;
