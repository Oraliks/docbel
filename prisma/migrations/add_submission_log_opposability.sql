-- Migration additive : opposabilité des générations PDF sans stockage
-- (lot S7 de l'audit du 2026-08-01, décision n°1 d'Oraliks — aucun fichier ni
-- payload n'est conservé, seules des métadonnées non nominatives le sont).
--
--   - "stablePayloadHash"  : SHA256 de la clé de contenu STABLE du document
--                            (champs auto et valeurs vides exclus, clés triées).
--                            Invariant à la date de téléchargement, contrairement
--                            à "payloadHash" qui inclut la date du jour injectée.
--                            → établit que deux générations portent le même
--                            contenu métier.
--   - "diagnosticsSummary" : { count, kinds: { <kind>: n } } — résumé du
--                            remplissage, JAMAIS le champ `detail` (qui porte
--                            des caractères saisis par le citoyen).
--                            → { "count": 0 } affirme qu'aucune case n'est
--                            restée blanche ; NULL = ligne antérieure à cette
--                            migration, complétude inconnue.
--
-- Non destructif : deux colonnes NULLABLES ajoutées, aucune donnée touchée.
-- Idempotent (IF NOT EXISTS) : rejouable sans effet.
-- ⚠ NE PAS passer par `prisma db push` sur la base Neon partagée (détruirait
--   pgvector et les tables PDF). Appliquer via :
--   npx prisma db execute --file prisma/migrations/add_submission_log_opposability.sql --schema prisma/schema.prisma

ALTER TABLE "PdfFormSubmissionLog"
  ADD COLUMN IF NOT EXISTS "stablePayloadHash" TEXT,
  ADD COLUMN IF NOT EXISTS "diagnosticsSummary" JSONB;

-- Recherche d'une génération par son contenu métier (« ce document a-t-il déjà
-- été généré ? ») — sans index, la requête scanne toute la table.
CREATE INDEX IF NOT EXISTS "PdfFormSubmissionLog_stablePayloadHash_idx"
  ON "PdfFormSubmissionLog" ("stablePayloadHash");
