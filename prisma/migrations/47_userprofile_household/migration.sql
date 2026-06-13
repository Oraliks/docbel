-- Composition de ménage sur le profil unique.
-- Tableau JSON de membres (conjoint, enfants, parents, cohabitants…) stocké
-- de manière contenue sur UserProfile plutôt que dans une table relationnelle.
-- Chaque membre : { firstName?, lastName?, relationship, birthDate?, hasRevenu? }.
-- La validation (taille ≤ 12, relationship dans l'ensemble autorisé) est faite
-- côté API (app/api/user/profile/route.ts).

ALTER TABLE "UserProfile"
  ADD COLUMN "householdMembers" JSONB;
