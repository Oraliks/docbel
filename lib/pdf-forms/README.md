# PDF Forms

Nouvelle fonctionnalité de génération de documents **basée exclusivement sur les
PDF à champs (AcroForm)**. Indépendante de l'ancien système `lib/documents` /
`DocumentTemplate` : aucune importation croisée, on peut supprimer l'ancien
système sans rien casser ici.

## Principe

Le flux réel est **seed-first**, et non admin-first comme à l'origine : les huit
documents ONEM sont décrits dans du CODE VERSIONNÉ (`seed/*-fields.ts`), pas
saisis à l'écran. L'éditeur d'admin reste, mais il est **verrouillé en lecture
seule** sur ces huit slugs (cf. `seed-lock.ts` et `SEEDED_SLUGS`) : il servira
aux futurs documents non-ONEM.

1. Le PDF officiel à champs est **déposé dans le dépôt** (`private/pdfs/`) et
   importé une fois (`POST /api/admin/pdf/forms`).
2. Le parseur extrait les champs AcroForm (`acroform-parser.ts`) → **schéma
   technique** (ancre immuable).
3. `field-inference.ts` pré-remplit un **schéma enrichi** (~80 %) : type
   sémantique (NISS, IBAN…), libellé FR depuis le tooltip, section, options.
4. Le seed du document **écrase cet enrichissement** (`seed/_merge.ts` +
   `seed/_shared/moules.ts`) : libellés, aides, conditions, peignes imprimés,
   découpage en étapes. Il est appliqué en base par
   `pnpm tsx scripts/apply-c1-improvements.ts --yes [--slug <slug>]`, qui crée
   une **révision** `seed_sync` et incrémente la version quand quelque chose
   change réellement (`seed/sync-plan.ts`).
5. Le front consomme la **vue publique** (`public-serializer.ts`, sans note
   interne ni détail technique), valide via `validation.ts`, et poste le
   payload → génération `filler.ts`.
6. Le PDF rempli **n'est jamais stocké** (RGPD) : download one-shot ou envoi
   **Doccle**. Seul un log d'audit sans PII est conservé
   (`PdfFormSubmissionLog` : hash stable du payload + comptage des
   diagnostics, jamais leur détail).

## Schéma à deux niveaux

- `technicalSchema` (`AcroFieldRaw[]`) : sortie brute du parseur. Ne change
  qu'au re-parse ou à une nouvelle version du PDF.
- `fields` (`PdfFormField[]`) : enrichissement éditable. Référence l'AcroForm
  via `pdfFieldName` (jamais modifié à la main).

## Versions

Ré-upload d'un PDF officiel → `POST /api/admin/pdf/forms/[id]/version` :
`apply=false` renvoie un **diff** (ajouts / suppressions / renommages probables) ;
`apply=true` archive l'ancienne version en révision, **migre l'enrichissement**
(`diff.ts`) et repasse le formulaire en `draft`.

## Polices

Les **trois sont versionnées** dans `public/fonts/` (suivies par git — rien à
déposer, rien à configurer) et lues paresseusement, une seule fois par
processus :

- `DejaVuSans-Latin.ttf` — principale. Couvre le latin étendu (Łukasz, Gökhan,
  Ștefan). Sans elle, `doc.save()` LÈVE sur tout nom hors Latin-1.
- `NotoSans-Regular.ttf` — repli, embarqué seulement si un texte en a besoin :
  grec, cyrillique, vietnamien. Ne remplace pas la principale, sinon la
  typographie de tous les PDF déjà générés changerait.
- `SignatureScript.ttf` — signature manuscrite « façon Adobe ».

Arabe, hébreu et chinois ne sont couverts par aucune des deux : la case sort
blanche et un diagnostic `caracteres-non-rendus` est journalisé (sans les
caractères eux-mêmes — RGPD).

## Intégrations (stubs)

- `integrations/itsme.ts` : prefill via OIDC. Logique en place, échange de code
  à finaliser dès réception des accès. Activé si `ITSME_*` est configuré.
- `integrations/doccle.ts` : envoi sécurisé. Signature stable, requête réseau à
  finaliser. Activé si `DOCCLE_*` est configuré.

## Tests

`__tests__/` : validation (NISS/IBAN, conditions, i18n), diff de versions,
round-trip parse→fill sur un PDF AcroForm généré à la volée. **Et sur les vrais
PDF** de `private/pdfs/`, versionnés eux aussi :

- `seed/__tests__/seeds-vs-pdf.test.ts` — chaque `pdfFieldName` du seed existe
  bien dans l'AcroForm ;
- `__tests__/widget-geometry.test.ts` — l'ordre déclaré suit l'ordre de LECTURE
  du papier (un champ ne peut pas pointer vers une case plus haute que le
  précédent). Les écarts assumés sont listés à l'égalité stricte.

Recette manuelle par document : `scripts/gen-<slug>-scenarios.ts` produit des
PDF remplis couvrant chaque branche, et
`python scripts/verif-couverture-widgets.py <dossier> <pdf-vierge>` mesure la
part des widgets réellement servis. Aucun test ne certifie qu'une déclaration
officielle est CORRECTE — c'est une relecture humaine.

`pnpm test` (~2 320 tests, joués en CI à chaque push).

