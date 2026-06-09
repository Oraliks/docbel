-- Déclencheurs de sous-formulaires portés par chaque PdfForm.
-- Quand le payload satisfait un trigger, le PdfForm cible (slug) est ajouté
-- au parcours utilisateur dynamiquement. La logique est dans
-- lib/pdf-forms/triggers.ts ; le runtime (app/outils/bundles/[slug]/page.tsx)
-- l'évalue au chargement du run, sans muter la DB.

ALTER TABLE "PdfForm"
  ADD COLUMN "triggers" JSONB NOT NULL DEFAULT '[]';
