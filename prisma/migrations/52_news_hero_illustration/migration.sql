-- Illustration DÉDIÉE au hero d'article (sans texte, sujet à droite).
-- Override l'illustration de la catégorie quand définie ; sinon repli sur
-- Category.illustrationUrl. JAMAIS confondue avec `image` (thumbnail/OG).
ALTER TABLE "News" ADD COLUMN "heroIllustration" TEXT;
