-- Migration 20 — Chômage IA : snippets réutilisables (command palette `/`)
--
-- Ajoute la table `ChatSnippet` pour stocker des phrases / templates fréquents
-- réutilisés via le command palette `/<shortcut>` dans la textarea chat ou
-- prompt brief. Le `shortcut` est utilisé pour le matching après la frappe du
-- `/` (filtre fuzzy côté client). Le `content` est ce qui sera inséré en
-- remplacement du `/query` dans la textarea.
--
-- Contrainte UNIQUE (domain, shortcut) : pas deux snippets avec le même
-- shortcut dans un même domaine (sinon ambiguïté côté palette).
--
-- Aucune donnée existante n'est altérée — table neuve, scope = "chomage" par défaut.

CREATE TABLE "ChatSnippet" (
    "id"          TEXT NOT NULL,
    "shortcut"    TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "content"     TEXT NOT NULL,
    "domain"      TEXT NOT NULL DEFAULT 'chomage',
    "order"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ChatSnippet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatSnippet_domain_shortcut_key"
    ON "ChatSnippet"("domain", "shortcut");

CREATE INDEX "ChatSnippet_domain_order_idx"
    ON "ChatSnippet"("domain", "order");
