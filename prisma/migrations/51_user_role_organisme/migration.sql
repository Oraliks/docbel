-- Docbel Formations — Lot A : nouveau rôle `organisme` (additif).
-- Ajoute une valeur à l'enum Postgres UserRole. Aucune donnée modifiée.
-- `IF NOT EXISTS` rend l'opération idempotente (PG 9.6+).

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'organisme';
