# Spec — Autofill employeur via BCE (chantier 2 : pré-remplissage éclair)

Date : 2026-08-03 · Design **validé par Oraliks** (brainstorm de session).
Prochaine étape : plan d'implémentation (writing-plans), puis exécution.

## Contexte

Chantier 2 du brainstorm 2026-08-02 « quoi automatiser dans les formulaires
PDF », retenu avec [la feuille de route](2026-08-02-feuille-de-route-design.md)
(chantier 1, livré). Idée d'origine : « pré-remplissage éclair » — brancher le
lookup KBO existant au runner, dériver le sexe du NISS, discuter un scan eID.

## Ce qui a changé par rapport à l'idée d'origine

Deux découvertes en explorant le code, avant tout design :

1. **Aucun des 8 formulaires ONEM ne demande le sexe.** Recherche exhaustive
   dans les seeds (`sexe`, `civilité`, `Monsieur/Madame`) : aucun résultat.
   L'idée « dériver le sexe du NISS » n'a pas de champ cible — abandonnée,
   pas de widget correspondant sur aucun PDF officiel.
2. **Les blocs employeur n'existent que sur 2 documents** : C1A
   (`employeurNom` + `employeurAdresse`) et C1B (`congeSansSoldeNomEmployeur`
   + `congeSansSoldeAdresseEmployeur`). Les 6 autres formulaires n'en ont pas.
3. Le scan eID reste **hors périmètre**, à rebrainstormer séparément (décision
   Oraliks 2026-08-03) — portée et enjeux RGPD trop différents pour ce lot.

Le chantier se réduit donc à l'autofill employeur par recherche BCE.

## Architecture

Même patron que l'autocomplete de rue déjà présent dans le formulaire
(`components/ui/street-autocomplete-input.tsx`) : un prop déclaratif sur
`PdfFormField`, un module pur de parsing/formatage, un composant client
d'autocomplete, une route publique dédiée. Aucune nouvelle abstraction
générique — copie conforme de la mécanique existante, appliquée à une
troisième source de données (après rues et communes).

### Nouveau prop déclaratif

`lib/pdf-forms/types.ts` — sur `PdfFormField` :

```ts
/// Transforme ce champ texte en autocomplete d'entreprise belge (mirroir KBO
/// local, cf. lib/be-companies/kbo-lookup.ts). Choisir une suggestion remplit
/// aussi le champ adresse en retour (cf.
/// components/ui/enterprise-autocomplete-input.tsx).
enterpriseAutocomplete?: { addressFieldId: string };
```

Miroir exact de `streetAutocomplete?: { postalFieldId: string }`.

### Route publique

`GET /api/lookup/entreprise?q=<nom>` — enveloppe `searchByName` de
`lib/be-companies/kbo-lookup.ts` (déjà en base, rafraîchie par le cron
`/api/cron/kbo-refresh`). Publique, non authentifiée, rate-limitée avec les
mêmes utilitaires que les autres routes citoyen (`checkRateLimit`,
`getClientIp`). Distincte de `/api/admin/lookup/bce` (qui reste admin-only,
inchangée) : ce n'est pas une ouverture de l'existant, c'est une route sœur au
périmètre volontairement plus étroit (recherche par nom uniquement — pas de
recherche par numéro, YAGNI : l'UX retenue est name-first, cf. décision
ci-dessous).

### Module pur

`lib/pdf-forms/enterprise-suggestions.ts` (mirroir de `street-suggestions.ts`) :
- `parseEnterpriseSuggestions(raw)` → `{ bceNumber, name, address }[]`, en
  ignorant les entreprises sans dénomination exploitable.
- `formatEnterpriseAddress(registeredOffice)` → une ligne
  (`"Rue Machin 12, 1000 Bruxelles"`), puisque le champ PDF cible est du texte
  libre, pas des sous-champs structurés. Absence de rue/CP/ville → chaîne
  vide plutôt qu'une adresse tronquée trompeuse.

### Composant client

`components/ui/enterprise-autocomplete-input.tsx` — copie conforme de
`street-autocomplete-input.tsx` : debounce 300 ms, minimum 3 caractères,
dropdown stylé identique, repli silencieux en texte libre si l'API échoue.
Source : `/api/lookup/entreprise` au lieu de `/api/lookup/search`.

### Câblage runner

- `components/pdf-forms/pdf-field.tsx` — nouvelle branche de rendu quand
  `field.enterpriseAutocomplete` est présent, symétrique à la branche
  `streetAutocomplete` existante.
- `components/pdf-forms/pdf-form-runner.tsx` — nouveau callback
  `onSelectEnterpriseAddress(fieldId, address)`, même mécanique que
  `onSelectStreetSuggestion` pour le code postal : écrit dans le champ adresse
  désigné par `addressFieldId`.

## Comportement produit

- **Toujours pré-rempli, jamais verrouillé** : nom et adresse restent
  éditables après sélection — même philosophie que le reste du formulaire
  (« informatif jamais bloquant », cf. `docs/context/PDF_FORMS_RULES.md`).
- **Aucun `requireListMatch`** : contrairement aux rues (BeStAddress, source
  exhaustive), le mirroir KBO peut ne pas couvrir un employeur (indépendant
  récent, structure étrangère…) — une frappe libre sans sélection reste
  acceptée et soumise telle quelle.
- **Limite assumée, dite à l'écran** : le mirroir KBO ne porte que l'adresse
  du **siège social** (`typeOfAddress = "REGO"` dans `kbo-lookup.ts`), pas les
  unités d'établissement. Pour un employeur multi-sites, l'adresse suggérée
  peut différer du lieu de travail réel. Le texte d'aide du champ le dit :
  « Adresse du siège social — à corriger si vous travailliez ailleurs. »

## Portée

| Inclus | Exclu |
|---|---|
| `employeurNom`/`employeurAdresse` (C1A) | Sexe dérivé du NISS (aucun champ cible) |
| `congeSansSoldeNomEmployeur`/`congeSansSoldeAdresseEmployeur` (C1B) | Scan eID (hors périmètre, à rebrainstormer) |
| Recherche par nom (autocomplete) | Recherche par n° BCE (non retenue pour V1) |
| — | Unités d'établissement (donnée absente du mirroir) |

## Tests

- `enterprise-suggestions.ts` : parsing (dénomination absente → ignorée),
  formatage d'adresse (tous les champs présents, rue/CP manquants → vide).
- Route : shape de réponse, rate-limit actif, requête vide/trop courte → pas
  d'appel DB inutile (même garde que la recherche de rue, `MIN_CHARS`).

## Rollout

Le code seul ne suffit pas : `pnpm tsx scripts/apply-c1-improvements.ts --yes`
doit tourner contre la base partagée pour que le nouveau prop atteigne
l'écran (même mécanisme que toute évolution de `c1a-fields.ts`/`c1b-fields.ts`,
cf. `docs/context/PDF_FORMS_RULES.md`). Lancement laissé à Oraliks, comme pour
les lots C1A précédents.

## Validation

```bash
pnpm test          # module pur + route
pnpm build          # build + typecheck
pnpm lint           # pas de nouvelle erreur
```
Écrans à vérifier : C1A (bloc « Données concernant votre employeur »), C1B
(bloc congé sans solde), clair/sombre, repli si l'API échoue (texte libre
toujours utilisable).
