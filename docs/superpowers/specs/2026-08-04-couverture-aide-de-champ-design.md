# Spec — Couverture de l'aide de champ (chantier 4 : assistant par champ, sans IA)

Date : 2026-08-04 · Design **validé par Oraliks** (brainstorm de session).
Prochaine étape : plan d'implémentation par document, en commençant par le
plus petit (C46).

## Contexte et changement de cadrage

Chantier 4 du brainstorm 2026-08-02 « quoi automatiser dans les formulaires
PDF », après [feuille de route](2026-08-02-feuille-de-route-design.md),
[autofill employeur](2026-08-03-autofill-employeur-bce-design.md) et
[aperçu du PDF](2026-08-04-apercu-pdf-mes-documents-design.md), tous livrés.

Idée d'origine : un bouton « je ne comprends pas » ouvrant `chomage-ia` avec
le contexte du champ pré-chargé. **Écartée par Oraliks** (2026-08-04) : pas
d'IA sur le form-runner ni les PDF pour l'instant. Le chantier devient :
améliorer la couverture de l'aide de champ **statique** existante — un
mécanisme déjà en place (`help: Localized` sur `PdfFormField`, affiché par
`ContextHelpPanel` via `pickFieldHelp` quand un champ a le focus), zéro IA.

## Constat chiffré (audit du 2026-08-04, requête directe sur les formulaires
publiés — source de vérité runtime, pas les seeds)

313 champs pertinents (hors masqués/auto/signature) à travers les 8
formulaires ; **139 ont une aide (44,4 %)**.

| Document | Total | Avec aide | Couverture |
|---|---|---|---|
| C46 | 10 | 8 | 80 % |
| C1-Partenaire | 16 | 12 | 75 % |
| C1-Changement | 85 | 56 | 66 % |
| C1C | 23 | 13 | 57 % |
| C47 | 9 | 4 | 44 % |
| C1-Regis | 33 | 14 | 42 % |
| C1B | 36 | 9 | 25 % |
| C1A | 101 | 23 | **23 %** |

## Nature du chantier : contenu sourcé, pas du code

Le mécanisme d'affichage existe déjà — aucun fichier `.ts`/`.tsx` de logique
n'est touché. Le travail consiste à ajouter `help: { fr: "..." }` sur des
champs de seed existants. Il est soumis à la règle anti-invention du dépôt
(`docs/context/PDF_FORMS_RULES.md`) : tout texte est recopié du PDF officiel
(`private/pdfs/<DOC>_FR.pdf`, extraction markitdown) ou de sa notice ; une
formulation absente ou ambiguë part en question à Oraliks, jamais en texte
inventé.

## Découverte structurante : regrouper, ne pas rédiger champ par champ

Vérifié sur le C1A (extraction markitdown) : les grilles horaires (questions
4 et 18, ~30 champs chacune — jour × tranche horaire) partagent un texte
imprimé **unique et répété** (« lundi — avant 7h — entre 7h et 18h — après
18h », identique pour chaque jour). Rédiger un texte distinct par case n'a
aucun sens ; un seul texte s'applique à tout le groupe.

Le nombre de *champs* sans aide (174) est donc très supérieur au nombre de
*textes* réellement à rédiger. Familles identifiées :
- **Grilles horaires** (C1A q4/q18) — un texte par grille.
- **Paires « Différence / C1 »** (C1-Regis : nationalité, adresse, 5
  personnes) — un texte par concept, appliqué aux 2 champs de chaque paire.
- **Séries d'annexes** (« je joins… ») — le texte précise le document exact à
  joindre, souvent déjà lisible dans le libellé imprimé voisin.
- **Champs triviaux** (nom, prénom, rue, code postal…) — malgré la cible
  proche de 100 %, un champ sans besoin réel d'aide est signalé comme tel
  plutôt que de recevoir un texte creux.

## Processus

Un document à la fois — même patron que les autres chantiers de contenu du
projet (vouvoiement S10, relecture C1/C1-Partenaire). Chaque lot :
1. Extraction markitdown du PDF officiel.
2. Identification des groupes et rédaction sourcée (citation de la source en
   commentaire du seed, comme le reste du dépôt).
3. Application aux champs concernés (`help: { fr: "..." }`).
4. `/verif-reglementation` sur le seed modifié.
5. Relecture Oraliks **avant** de passer au document suivant.

**Ordre** : commencer petit pour calibrer le rythme et le format — C46 (2
champs manquants) ou C47 (5) avant le C1A (78 champs bruts, regroupés en
bien moins de textes réels).

## Portée

| Inclus | Exclu |
|---|---|
| `help` sourcé sur les champs sans aide, par document | Toute forme d'IA (form-runner, PDF) |
| Regroupement par famille (grilles, paires, annexes) | Récriture des aides déjà présentes (hors erreur avérée) |
| Un document = un lot, relu avant le suivant | Nouveau mécanisme d'affichage (celui existant suffit) |

## Rollout

Comme toute évolution de seed `C1_IMPROVEMENT_TARGETS`
(`lib/pdf-forms/seed/apply-c1-improvements-core.ts`) : le nouveau contenu
n'atteint l'écran qu'après `pnpm tsx scripts/apply-c1-improvements.ts --yes`
contre la base partagée — lancement laissé à Oraliks, comme pour les lots
précédents.

## Validation par lot

```bash
pnpm test          # les tests de géométrie/mapping existants ne doivent pas casser
pnpm build
pnpm lint           # pas de nouvelle erreur
```
Écran à vérifier : le champ concerné dans le formulaire, panneau « À propos
de ce champ » visible au focus.
