-- Ajoute la relation Organisme ↔ PdfForm (FK nullable, ON DELETE SET NULL).
-- Permet de rattacher un PdfForm à un organisme émetteur référencé (ONEM,
-- CPAS, …) au lieu / en plus du champ `issuer` libre conservé.

ALTER TABLE "PdfForm" ADD COLUMN "organismeId" TEXT;

CREATE INDEX "PdfForm_organismeId_idx" ON "PdfForm"("organismeId");

ALTER TABLE "PdfForm" ADD CONSTRAINT "PdfForm_organismeId_fkey"
    FOREIGN KEY ("organismeId") REFERENCES "Organisme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
