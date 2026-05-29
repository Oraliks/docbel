-- Ajoute les colonnes nécessaires à l'éditeur visuel d'AcroForms du module
-- PDF Forms. Cf. lib/pdf-forms/visual/types.ts pour la structure du wrapper.
ALTER TABLE "PdfForm"
  ADD COLUMN "visualFields" JSONB NOT NULL DEFAULT '{"version":1,"fields":[]}',
  ADD COLUMN "visualFieldsMaterializedAt" TIMESTAMP(3);
