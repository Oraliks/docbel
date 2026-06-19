-- Champs enrichis optionnels sur les articles News.
-- keyTakeaway : courte accroche "À retenir" (texte libre).
-- summary     : bullets "Résumé en 30 sec" (tableau JSON de chaînes).
-- linkedDocs  : documents liés { title, url }[] (tableau JSON d'objets).
-- faqs        : questions fréquentes { q, a }[] (tableau JSON d'objets).

ALTER TABLE "News" ADD COLUMN "keyTakeaway" TEXT;
ALTER TABLE "News" ADD COLUMN "summary"     JSONB;
ALTER TABLE "News" ADD COLUMN "linkedDocs"  JSONB;
ALTER TABLE "News" ADD COLUMN "faqs"        JSONB;
