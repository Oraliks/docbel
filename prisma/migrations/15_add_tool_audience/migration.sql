-- Migration 15 — Tool.audience (citoyen | employeur | partenaire)
--
-- Audience hiérarchique : citoyen = visible par tous, employeur = visible
-- par employeur+partenaire, partenaire = visible uniquement par partenaire.
-- Sert au filtrage côté pages publiques (/outils, /employeur, /partenaire).
--
-- Cf. lib/audience.ts → canViewAudience(toolAudience, viewerAudience).

ALTER TABLE "Tool"
  ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'citoyen';
