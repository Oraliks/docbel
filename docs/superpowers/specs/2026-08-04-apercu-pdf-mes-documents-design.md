# Spec — Aperçu du PDF rempli (chantier 3 : relecture + aperçu)

Date : 2026-08-04 · Design **validé par Oraliks** (brainstorm de session).
Prochaine étape : plan d'implémentation (writing-plans), puis exécution.

## Contexte

Chantier 3 du brainstorm 2026-08-02 « quoi automatiser dans les formulaires
PDF », après [la feuille de route](2026-08-02-feuille-de-route-design.md)
(chantier 1) et [l'autofill employeur](2026-08-03-autofill-employeur-bce-design.md)
(chantier 2), tous deux livrés. Idée d'origine : un écran de relecture groupé
par étape, et un bouton « Voir mon document » affichant le PDF réellement
rempli avant téléchargement.

## Ce qui a changé par rapport à l'idée d'origine

Deux découvertes en explorant le code, avant tout design :

1. **Le formulaire n'a aucun écran de relecture aujourd'hui.** Le pied de la
   dernière étape (`SubmitFooter`) va directement de la signature au bouton
   final — pas d'étape intermédiaire.
2. **Dans un dossier, valider un document (« Continuer ») ne génère jamais de
   PDF.** Le payload est sauvegardé en JSON (`delivery: "save"`,
   `app/api/pdf/[slug]/generate/route.ts`) ; le PDF n'est produit qu'au
   téléchargement groupé, plus tard, depuis l'écran « Mes documents ». Un
   aperçu *avant* validation demanderait donc un nouvel endpoint de
   génération à blanc — rien de tel n'existe aujourd'hui pour ce mode.
   `regenerateOneDocument` (chantier 1) vérifie en interne
   `state.allRequiredDone` : techniquement, aucun aperçu n'est possible avant
   que le dossier ENTIER soit complet, sans changer cette politique de verrou
   (hors périmètre).

Décisions actées (Oraliks, 2026-08-04) :
- Le bouton vit **sur l'écran « Mes documents »**, pour les documents déjà
  validés — pas avant, pas pendant le remplissage.
- **PDF seul** : pas de récapitulatif texte parallèle. Le PDF est la relecture
  la plus fidèle (c'est le document exact que l'ONEM recevra) ; un rendu texte
  séparé risquerait de diverger du PDF réel.

## Architecture

Un seul changement technique : la route existante
`GET /api/bundles/runs/[runId]/download/[pdfFormId]` (créée au chantier 1,
verrouillée tant que le dossier n'est pas complet, propriété du run vérifiée
via `regenerateOneDocument`) accepte un paramètre optionnel `?inline=1`. Seul
effet : `Content-Disposition: attachment` devient `inline` — le navigateur
affiche son viewer PDF natif au lieu de forcer un téléchargement. Aucune
nouvelle route, aucun composant, aucune dépendance.

## Emplacement et libellé

`components/docbel/bundle-roadmap.tsx` porte déjà deux boutons par document
complété : **Revoir** (`roadmapReview`, rouvre le formulaire pour modifier) et
**Télécharger** (`roadmapDownloadOne`, force le download). Un troisième bouton
**Aperçu** s'ajoute, lien `<a target="_blank" href=".../download/[pdfFormId]?inline=1">` —
libellé distinct pour ne pas se confondre avec les deux autres.

## Analytics

`trackBundleEvent("documents_downloaded", ...)` marque la fin du parcours
dans le funnel « Parcours ». Un aperçu n'en est pas une : la route N'émet PAS
cet événement quand `inline=1` est présent, pour ne pas fausser la métrique de
dossiers réellement récupérés. Pas de nouvel événement dédié en V1 — simple
lien, sans tracking spécifique.

## Portée

| Inclus | Exclu |
|---|---|
| Bouton Aperçu sur documents déjà validés, écran Mes documents | Aperçu avant validation d'un document (nécessiterait de lever le verrou `allRequiredDone`) |
| Paramètre `?inline=1` sur la route existante | Récapitulatif texte des réponses |
| — | Nouvel événement analytics dédié |

## Tests

- Route : `Content-Disposition` bascule `attachment`↔`inline` selon le
  paramètre ; l'événement `documents_downloaded` n'est émis QUE sans
  `inline=1` ; verrou dossier incomplet (409) et propriété du run (404)
  inchangés dans les deux cas.
- Composant : le lien Aperçu est présent uniquement sur les documents
  complétés (même filtre que Revoir/Télécharger existants).

## Validation

```bash
pnpm test          # vitest
pnpm build          # build + typecheck
pnpm lint           # pas de nouvelle erreur
pnpm i18n:check
```
Écran à vérifier : Mes documents (`BundleRoadmap`), dossier complet, clic
Aperçu ouvre le PDF dans un nouvel onglet sans déclencher de téléchargement
forcé ; clair/sombre.
