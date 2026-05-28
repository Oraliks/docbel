# PDF Forms

Nouvelle fonctionnalité de génération de documents **basée exclusivement sur les
PDF à champs (AcroForm)**. Indépendante de l'ancien système `lib/documents` /
`DocumentTemplate` : aucune importation croisée, on peut supprimer l'ancien
système sans rien casser ici.

## Principe

1. L'admin **upload un PDF officiel à champs** (`POST /api/admin/pdf/forms`).
2. Le parseur extrait les champs AcroForm (`acroform-parser.ts`) → **schéma
   technique** (ancre immuable).
3. `field-inference.ts` pré-remplit un **schéma enrichi** (~80 %) : type
   sémantique (NISS, IBAN…), libellé FR depuis le tooltip, section, options.
4. L'admin enrichit (labels NL/DE, validation, prefill, conditions…) puis
   **publie** après contrôle (`publish-checks.ts`).
5. Le front (à venir) consomme la **vue publique** (`public-serializer.ts`,
   sans note interne ni détail technique), valide via `validation.ts`, et
   poste le payload → génération `filler.ts`.
6. Le PDF rempli **n'est jamais stocké** (RGPD) : download one-shot ou envoi
   **Doccle**. Seul un log d'audit sans PII est conservé (`PdfFormSubmissionLog`).

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

## Police Unicode

`filler.ts` embarque `public/fonts/NotoSans-Regular.ttf` si présent (via
`@pdf-lib/fontkit`) pour gérer les caractères hors Latin-1 (noms étrangers).
Sans police : repli sur Helvetica. La police n'est pas versionnée.

## Intégrations (stubs)

- `integrations/itsme.ts` : prefill via OIDC. Logique en place, échange de code
  à finaliser dès réception des accès. Activé si `ITSME_*` est configuré.
- `integrations/doccle.ts` : envoi sécurisé. Signature stable, requête réseau à
  finaliser. Activé si `DOCCLE_*` est configuré.

## Tests

`__tests__/` : validation (NISS/IBAN, conditions, i18n), diff de versions,
round-trip parse→fill sur un PDF AcroForm généré à la volée (pas de binaire
versionné). `pnpm test`.

## Seed des presets

`pnpm dotenv -e .env.local -- tsx scripts/seed-pdf-presets.ts`
