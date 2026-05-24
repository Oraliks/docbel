-- Migration 14 — Calculator assets (sources officielles) + revue annuelle
--
-- Permet à l'admin d'attacher des fichiers PDF / URLs / images officiels
-- à chaque calculateur citoyen, et de tracer la date de dernière vérification
-- de la fiabilité des chiffres (alerte à 12 mois).

-- 1) Tool : champs de tracking de la revue annuelle
ALTER TABLE "Tool"
  ADD COLUMN "lastReviewedAt" TIMESTAMP(3),
  ADD COLUMN "nextReviewDue"  TIMESTAMP(3);

CREATE INDEX "Tool_nextReviewDue_idx" ON "Tool"("nextReviewDue");

-- 2) CalculatorAsset : sources officielles attachées à un slug de calc
CREATE TABLE "CalculatorAsset" (
    "id"          TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "kind"        TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "description" TEXT,
    "url"         TEXT NOT NULL,
    "category"    TEXT,
    "fileSize"    INTEGER,
    "mimeType"    TEXT,
    "year"        INTEGER,
    "order"       INTEGER NOT NULL DEFAULT 0,
    "uploadedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalculatorAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CalculatorAsset_slug_idx" ON "CalculatorAsset"("slug");
CREATE INDEX "CalculatorAsset_slug_category_idx" ON "CalculatorAsset"("slug", "category");
CREATE INDEX "CalculatorAsset_slug_order_idx" ON "CalculatorAsset"("slug", "order");
