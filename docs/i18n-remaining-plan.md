# i18n — Plan du restant (feuille de route)

> **Date :** 2026-06-22 · Suite de `i18n-rollout-plan.md`.
> **État :** Fondation + garde-fous **faits** ; **admin externalisé** (3009 clés FR, `tsc`+`i18n:check` verts) ; **le site affiche FR partout** (7 langues = fallback).

Légende effort : **S** petit · **M** moyen · **L** gros. Qui : 🤖 moi seul · 🧑 décision/relecture toi · 💶 budget/natif.

---

## 0. Décisions à trancher (débloquent le reste) — 🧑

1. **Routing public** : mode **cookie** (rapide, pas d'URL par langue, comme l'admin) **vs** segment **`/fr/` `/nl/`…** (SEO, mais migration `[locale]` = gros déplacement de fichiers). → conditionne le Lot 3.
2. **Langues « live » d'abord** : reco **FR + EN + NL** en premier (les 3 que je peux pousser le plus vite/sûr), puis **DE**, puis **AR/TR/RO/BG** via correction communautaire.
3. **Assistant IA** : public ou interne ? + embeddings multilingues (reco) vs traduction KB. → conditionne le sous-lot KB.
4. **Glossaire** : valider les 9 ⚠️ + trancher « glose figée » (cf. `docs/i18n-glossaire.md`). → qualité du pipeline IA.

---

## 1. Finir l'admin (dernier kilomètre) — S · 🤖
- Lancer `pnpm lint:i18n` **scopé admin** → repérer les strings résiduelles dans les 117 `.tsx` sans `t()` (la plupart = layouts/loading/wrappers sans texte).
- Externaliser les résidus trouvés.
- Spot-check namespace `chomageIa` (rempli par 2 agents → ~20 clés génériques fusionnées).

## 2. Mécanisme de correction communautaire — M · 🤖 ⭐
La brique qui rend la qualité native **vérifiable** (et qui débloque AR/TR/RO/BG sans agence).
- Migration **additive** `TranslationSuggestion` `{ key, locale, currentValue, suggestedValue, comment, status, context, ipHash, createdAt }` (via `db execute`, **jamais `db push`** — Neon partagée).
- Bouton public « Proposer une meilleure traduction » (clone du pattern `BureauReport`/`FormValidationReport` déjà dans le code).
- File de modération dans `/admin/traductions` : approuver → écrit la clé dans la langue ; jamais auto-appliqué.
- Niveaux de confiance (visiteur anonyme = modération ; partenaire natif = poids fort).

## 3. Site public — extraction — L · 🤖 (après décision 0.1)
- Monter `NextIntlClientProvider` sur le layout public (+ `[locale]` si routing URL retenu).
- **Sélecteur de langue** dans le chrome public (header).
- Fan-out d'agents par groupe de routes : landing/home, outils + calculateurs, espaces pros (employeur/partenaire), auth/inscription, formations public, contact, mon-dossier/profil, glossaire, `[slug]` CMS, document, pdf public.
- Volume ≈ 4 000 strings → même méthode (agents → patch files → merge central → `tsc` strict).

## 4. Texte transverse — M · 🤖
- **Zod** (~300-400 messages) : centraliser en clés + résoudre à la locale (errorMap i18n).
- **Emails** (Resend dans `lib/auth.ts`) : sujets/corps par locale.
- **Erreurs API** (~80-100 FR) : enum + i18n, fallback EN.
- **better-auth** (~10 messages) : wrapper.
- **Assistant IA** : prompts restent FR, mais **réponse dans la langue de l'utilisateur**.

## 5. Formatage + SEO — S/M · 🤖
- Sweep des `fr-BE`/`toLocaleDateString`/`toLocaleString` codés en dur (30 fichiers + 64 usages) → helpers `lib/i18n/format.ts` (déjà créés).
- SEO (si routing URL) : `hreflang`, `canonical`, sitemap multilingue (+ formations/boussole manquantes).

## 6. Contenu DB — L · 🤖 techno / 🧑 arbitrages
- Migrations **additives idempotentes** (`db execute`) : table générique `ContentTranslation` (labels courts) + `NewsTranslation`/`ChangelogTranslation`/`PageTranslation` (texte riche) + labels JSON `{fr,nl,…}` (schémas Document/PdfForm).
- ⚠️ Bloqueur **Formations** : `slug` `@unique` + `language="fr"` figé → clé composite `(slug, locale)` ou table de trad (décision).
- UI `/admin/traductions` : éditeur de traductions du contenu DB (généralise le pattern lookup `EditableCell`).
- Résolveur lecture + fallback FR + invalidation cache au save.
- **Lookup DE** (exception FR/NL/DE) : harvest CSV ONEM (gratuit) → IA → relecture (~3-11k€).

## 7. Traductions réelles FR→7 langues — L · mix 🤖 + 🧑 + 💶
- **Pipeline Claude + glossaire** : 1er jet des **3009 clés UI** + contenu DB, par vagues.
- Relecture : **FR/EN** ✅ moi · **NL/DE** passe native conseillée · **AR/TR/RO/BG** = IA + **correction communautaire (Lot 2)** + relecture ciblée.
- Statut par clé (brouillon/IA/révisé/publié) ; n'afficher « publié » que pour la qualité voulue.

## 8. Qualité & activation — M · 🤖 + 🧑
- **RTL arabe** : sweep CSS logiques (`ml/mr/pl/pr/left/right/text-left` → `ms/me/ps/pe/start/end/text-start`), `dir="rtl"`.
- **Activation progressive** : `AppSetting` `enabled[]` → n'exposer une langue au public que quand sa couverture est suffisante.
- QA par locale ; brancher `pnpm i18n:check` en **CI** ; `lint:i18n` en pre-commit sur le diff.

---

## Ordre recommandé
**1 (finir admin)** → **2 (correction tool)** → *décision routing 0.1* → **3 (public)** → **4 (transverse)** → **5 (format/SEO)** → **6 (DB)** → **7 (traductions par vagues)** → **8 (RTL/QA)**.

**Je peux démarrer tout de suite sans aucune décision : Lots 1 et 2.** Le reste s'enchaîne dès les arbitrages du §0.
