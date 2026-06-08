-- Toggle de disponibilité publique sur PdfForm.
-- active=false sur un PdfForm publié affiche un message "indisponible"
-- côté /document/[slug] au lieu d'un 404. Permet à l'admin de mettre en
-- pause un formulaire pour le corriger / mettre à jour son PDF officiel.

ALTER TABLE "PdfForm"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "disabledMessage" TEXT;
