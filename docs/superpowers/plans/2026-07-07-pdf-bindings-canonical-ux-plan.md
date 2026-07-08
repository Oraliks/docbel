# Plan — Bindings PDF déclaratifs, vocabulaire canonique, URLs SEO, mobile compact, reset, visualiseur admin

> **Exécutant : Opus 4.7.** Ce plan a été validé avec Oraliks le 2026-07-07 (session Fable).
> Chaque phase = 1 à 3 commits. Ne pas marquer « fait » ce qui est seulement planifié.
> En cas de doute métier → poser la question à Oraliks, ne pas inventer.

---

## 0. Contexte — à lire AVANT de coder

### Lecture obligatoire (dans cet ordre)
1. `lib/pdf-forms/types.ts` — PdfFormField : `autoAnswered`, `derivedFrom`, `visibleIfParent`, `requiredGroup`, `stepGroup`, `hidden`
2. `lib/pdf-forms/filler.ts` — stamping : `stampScalarWidget` (uniform font 10, formatDateFR, strip BE sur type iban), `stampPipeRadio` (convention pipe), skip `hidden` + skip `visibleIf` false
3. `lib/pdf-forms/validation.ts` — `buildValidator` EXCLUT les `isAutoField` du schéma Zod entier (shape + superRefine)
4. `components/pdf-forms/pdf-form-runner.tsx` — submit() chaîne actuellement 6 transforms + `applyFieldDerivations`
5. `lib/pdf-forms/seed/c1-fields-improvements.ts` — schéma C1 enrichi + `applyC1Improvements` + `C1_TRIGGERS`
6. `app/api/pdf/[slug]/generate/route.ts` — route génération (valide côté serveur puis `fillForm`)
7. `lib/pdf-forms/seed/apply-c1-improvements-core.ts` — `C1_IMPROVEMENT_TARGETS`
8. `components/docbel/bundle-runner.tsx` + `app/d/[slug]/page.tsx` — plomberie bundle/dossier (`bundlePrefill`, `bundleRunId`)

### Les 6 transforms client actuels (à migrer en règles serveur — Phase 1)
Chaînés dans `submit()` du runner, dans cet ordre (le plus profond s'exécute en premier) :
1. `applyMotifTransferOverride` (`lib/pdf-forms/c1-motif-transfer.ts`) — chip transfert OP → motifIntroduction="changement-op"
2. `applyIbanCountryRouting` (`c1-iban-routing.ts`) — IBAN non-BE → vide `iban`, remplit `sepa_tranger_iban_bic`
3. `applyRemarqueSituationFamiliale` (`c1-remarque-derivation.ts`) — cohousing / jugement en cours → widget "Remarques 1"
4. `applyTitulaireCompteNomDerivation` (`c1-titulaire-derivation.ts`) — mon-nom → "Prénom Nom" user dans `titulaireCompteNomStamp`
5. `applyIbanSplitDerivation` (`c1-iban-split.ts`) — IBAN BE → 4 groupes : `ibanCheckDigits`("B E", maxLen 2), `ibanPart1..3`(undefined_11/12/13, maxLen 4 chacun)
6. `applyDateHeaderP2Derivation` (`c1-date-header-p2.ts`) — dateModificationEffective ?? dateDemande → widget "Date de DA"

`applyFieldDerivations` (`field-derivations.ts`) reste CLIENT (nécessaire à la validation : date naissance ← NISS, pays ← code postal). Il est aussi appelé dans `attemptAdvance` avant `findFirstInvalidStep`.

### Champs « workaround » du schéma à SUPPRIMER une fois les règles en place
Dans `c1-fields-improvements.ts` : `ibanCheckDigits`, `ibanPart1/2/3`, `titulaireCompteNomStamp`, `dateHeaderP2`, `statutRefugie`, `apatrideReconnu`, `sepa_tranger_iban_bic` (autoAnswered). Ils n'existaient que parce que le stamping passait par le payload. Avec des règles qui émettent des stamps widget directement, ils deviennent inutiles. ⚠️ Les retirer SEULEMENT en Phase 7, après validation prod des règles.

### Widgets AcroForm C1 — pièges connus (vérifiés au dump pdf-lib)
- `"B E"` : PDFTextField **maxLength=2** (reçoit les 2 chiffres de contrôle, ex. "68")
- `undefined_11/12/13` : maxLength=4 chacun (groupes de 4 chiffres)
- Grille cohabitants : `"1 1".."5 2"` (col 1) + `"1","1_2".."2_5"` (col 2, irrégulier)
- Convention pipe-radio : `"oui_18|non_19"` = 2 checkboxes distinctes, PAS un PDFRadioGroup
- `setText` au-delà du maxLength d'un widget → **throw** pdf-lib (silencieusement avalé par le try/catch du filler → case vide). Toujours vérifier maxLength au dump avant de mapper.
- Dump : `pnpm tsx scripts/dump-c1.ts` (écrit la liste widgets+positions+tooltips)

### Gotchas d'environnement (mémoire de session — NE PAS ignorer)
- **Git** : workdir partagé multi-agents → `git add` de chemins EXPLICITES uniquement, jamais `-A`. Jamais `--force` sur main.
- **DB Neon partagée** : JAMAIS `prisma db push` (détruit pgvector + tables PDF). Schéma = SQL additif via `pnpm prisma db execute --stdin`. Mettre à jour `prisma/schema.prisma` pour refléter, puis `prisma generate` (⚠️ arrêter le dev server avant generate).
- **Bash sandboxé** revert les edits de fichiers trackés → `dangerouslyDisableSandbox: true` pour git/build/tests.
- **Build** : `pnpm build` (pas de `pnpm typecheck`). `rm -rf .next` avant si un dev server a tourné (types routes corrompus). Arrêter le preview server avant.
- **Après toute modif du schéma C1** : `pnpm tsx scripts/apply-c1-improvements.ts --yes` (idempotent, cible les slugs de `C1_IMPROVEMENT_TARGETS`) — la DB de prod EST cette DB.
- **Déploiement** : push sur main → Vercel auto-deploy (~3-5 min). Vérifier : `curl -s https://www.docbel.be/ | grep -oE "dpl_[a-zA-Z0-9]+" | head -1` change d'id. Tester ensuite sur https://www.docbel.be/document/c1-changement-situation (Oraliks a un brouillon enregistré).
- **preview_screenshot** timeout systématique dans cet env → valider via preview_snapshot/eval/inspect.
- **i18n** : seules fr/nl/en ont les clés admin ; toute nouvelle clé UI → les 3 fichiers `messages/{fr,nl,en}.json` + `pnpm i18n:check`.
- Validation finale de chaque phase : `pnpm vitest run lib/pdf-forms/` (328+ tests actuellement verts) puis build.

---

## Phase 1 — Moteur de bindings déclaratif (serveur)

**Objectif** : remplacer les 6 transforms client par un tableau de règles par formulaire, évalué CÔTÉ SERVEUR dans la route generate. Option retenue avec Oraliks : `when` objet déclaratif pour les cas simples + `whenFn` fonction pour les cas complexes (hybride).

### 1.1 — `lib/pdf-forms/bindings/types.ts`
```ts
import type { FormPayload, FieldValue } from "../types";

export type WhenCondition =
  | string | number | boolean                    // égalité stricte
  | { equals: FieldValue }
  | { in: readonly (string | number)[] }
  | { not: FieldValue }
  | { matches: string };                          // SOURCE regex (string, sérialisable)

/// AND implicite entre les clés.
export type WhenClause = Record<string, WhenCondition>;

export interface StampEntry {
  widget: string;                 // pdfFieldName EXACT du widget AcroForm
  value: string | boolean;        // boolean → checkbox ; string → text field
}

export interface MappingRule {
  name: string;                   // unique, sert au debug + à l'override shared→per-form
  when?: WhenClause;
  whenFn?: (v: FormPayload) => boolean;   // si when ET whenFn → AND
  stamp?: StampEntry[];
  stampFn?: (v: FormPayload) => StampEntry[];
}
```
⚠️ PAS de convention pipe dans les règles : une règle émet des stamps par widget individuel (`{ widget: "non_17", value: true }`). Le pipe reste réservé au mapping schéma historique.

### 1.2 — `lib/pdf-forms/bindings/engine.ts`
- `evaluateWhen(rule, payload): boolean` — objet ET fonction, AND. Règle sans when/whenFn = toujours active.
- `resolveStamps(payload, rules): Map<string, string | boolean>` — itère dans l'ordre, **dernier gagnant par widget** (permet l'override).
- `bind(fieldId, widget, format?)` — helper qui fabrique une MappingRule « stampe la valeur du champ si non vide » ; `format`: `"date-fr" | "iban-strip-be"` (réutiliser `formatDateFR` — l'exporter depuis filler.ts ou le déplacer dans un module partagé `bindings/format.ts` pour éviter l'import croisé).
- Module PUR : aucun import fs/prisma (testable, importable partout).

### 1.3 — `lib/pdf-forms/bindings/shared.ts`
Helpers paramétrés par les noms de widgets de chaque document (on partage la SÉMANTIQUE, pas les noms) :
```ts
export function identityBindings(w: { nom: string; prenom: string; niss: string; dateNaissance?: string; nationalite?: string }): MappingRule[]
export function addressBindings(w: { rue: string; numero: string; boite?: string; codePostal: string; pays?: string }): MappingRule[]
```

### 1.4 — `lib/pdf-forms/bindings/per-form/c1-changement.ts`
Migrer les 6 transforms + les auto-non en règles. Liste EXHAUSTIVE des règles à écrire (comportements validés en prod cette session — les reproduire à l'identique) :

| Règle | when | stamps |
|---|---|---|
| `motif-modification` | `{ motifIntroduction: "modification", transfereOrganismePaiement: { not: true } }` | `je déclare une modification concernant` = true |
| `motif-transfert-op` | `{ transfereOrganismePaiement: true }` | `je change dorganisme de paiement à partir du 5` = true, `je déclare une modification concernant` = false |
| `chip-adresse` | `{ modificationAdresse: true }` | `mon adresse à partir du` = true |
| `chip-famille` | `{ modificationSituationFamiliale: true }` | `ma situation personnelle ou celle des membres de mon ménage 7` = true |
| `chip-permis` | `{ modificationPermisSejour: true }` | `mon permis de séjour ou mon permis de travail` = true |
| `chip-compte` | `{ modificationCompte: true }` | `le mode de paiement de mes allocations ou mon numéro de compte6` = true |
| `iban-be-split` | whenFn: iban commence par BE (14 chiffres après) | `B E`=digits[0:2], `undefined_11`=[2:6], `undefined_12`=[6:10], `undefined_13`=[10:14] |
| `iban-etranger` | whenFn: iban non-BE | `SEPA étranger IBAN  BIC` = iban complet |
| `titulaire-mon-nom` | `{ modePaiement: "virement", titulaireCompte: "mon-nom" }` | `Nom du titulaire` = stampFn "Prénom Nom" depuis pr_nom+nom |
| `titulaire-autre` | `{ modePaiement: "virement", titulaireCompte: "autre-nom" }` | `Nom du titulaire` = stampFn valeur de titulaireCompteNom |
| `remarque-fam` | whenFn: cohousing OU jugement en-cours/pas-encore-recu | `Remarques 1` = stampFn parts.join(" ; ") (reprendre la logique de c1-remarque-derivation.ts) |
| `date-header-p2` | whenFn: dateModificationEffective ?? dateDemande non vide | `Date de DA` = stampFn date formatée FR |
| `hors-eee-non` | `{ nationaliteHorsEEE: "non" }` | `non_17`=true, `non_18`=true, `non_19`=true |
| `niss-header-p2` | whenFn: niss non vide | (vérifier au dump si le NISS p2 a un widget dédié ; sinon skip — le header NISS actuel fonctionne, ne pas casser) |

### 1.5 — `lib/pdf-forms/bindings/registry.ts`
```ts
const RULES_BY_SLUG: Record<string, MappingRule[]> = {
  "c1-changement-situation": C1_CHANGEMENT_RULES,
  // c1, c1-insertion : Phase 7 (partagent la famille — composer depuis une base commune)
};
export function getRulesForSlug(slug: string): MappingRule[] { return RULES_BY_SLUG[slug] ?? []; }
```

### 1.6 — Intégration filler + route generate
- `filler.ts` : ajouter `opts.extraStamps?: Map<string, string | boolean>` à `fillForm`. Appliqué APRÈS la boucle fields (les règles gagnent sur le schéma). Checkbox → check/uncheck ; TextField → setText + setFontSize(UNIFORM_TEXT_FONT_SIZE) ; try/catch par widget MAIS logger `console.warn` les échecs (maxLength !) au lieu d'avaler silencieusement.
- `app/api/pdf/[slug]/generate/route.ts` : après validation, avant fillForm :
  ```ts
  const stamps = resolveStamps(validated, getRulesForSlug(form.slug));
  const pdfBytes = await fillForm(source, fields, validated, { technicalSchema, extraStamps: stamps });
  ```
- **Coexistence** : NE PAS retirer les 6 transforms client tout de suite. Les règles serveur sont idempotentes par-dessus (mêmes valeurs). Retrait en Phase 7.

### 1.7 — Tests (`lib/pdf-forms/bindings/__tests__/`)
- `engine.test.ts` : chaque WhenCondition, AND implicite, whenFn+when combinés, dernier-gagnant par widget, règle sans when.
- `c1-changement.test.ts` : reprendre le scénario de repro de la session (isolé + modificationAdresse + IBAN BE68 5390 0754 7034 + mon-nom + nationaliteHorsEEE non) et asserter la Map de stamps complète. Ajouter : cas transfert OP, cas IBAN FR (étranger), cas titulaire autre-nom, cas cohousing.
- Test d'intégration filler : `fillForm` avec extraStamps sur un PDF minimal (pattern des tests filler-array existants).

**Commit 1** : engine + types + shared + tests. **Commit 2** : règles C1 + registry + intégration generate + tests.

---

## Phase 2 — Vocabulaire canonique + pré-remplissage croisé (PRIORITÉ MÉTIER)

**Objectif validé par Oraliks** : « il est illogique pour la personne de devoir remettre 2× la même information ». Quand le C1 déclenche un C1A/C47/REGIS, les champs identité/adresse/banque arrivent PRÉ-REMPLIS.

### 2.1 — `lib/pdf-forms/canonical/vocabulary.ts`
```ts
export const CANONICAL_KEYS = [
  "identity.nom", "identity.prenom", "identity.niss", "identity.dateNaissance", "identity.nationalite",
  "adresse.rue", "adresse.numero", "adresse.boite", "adresse.codePostal", "adresse.pays",
  "contact.email", "contact.telephone",
  "banque.iban", "banque.bic", "banque.titulaire",
  "famille.statut",           // isole | cohabite
] as const;
export type CanonicalKey = (typeof CANONICAL_KEYS)[number];
```
Rester MINIMAL : uniquement ce qui se partage réellement entre documents. Ne pas canoniser les champs spécifiques C1.

### 2.2 — `canonicalKey?: CanonicalKey` sur PdfFormField
- `types.ts` + `public-serializer.ts` (interface + toPublicField).
- Poser dans `c1-fields-improvements.ts` : `nom→identity.nom`, `pr_nom→identity.prenom`, `niss→identity.niss`, `date_de_naissance→identity.dateNaissance`, `nationalit_3→identity.nationalite`, `adresse_rue→adresse.rue`, `num_ro→adresse.numero`, `num_ro_de_bo_te→adresse.boite`, `code_postal→adresse.codePostal`, `pays→adresse.pays`, `adresse_email_facultatif→contact.email`, `num_ro_de_t_l_phone_facultatif→contact.telephone`, `iban→banque.iban`, `bic→banque.bic`, `statutFamilial→famille.statut`.
- Poser les équivalents dans les seeds compagnons : `c1a-fields.ts`, `c1b-fields.ts`, `c1c-fields.ts`, `c46-fields.ts`, `c47-fields.ts`, `c1-partenaire-fields.ts`, `c1-regis-fields.ts` (lire chaque seed, identifier les champs identité — ids souvent différents).
- Re-appliquer : `pnpm tsx scripts/apply-c1-improvements.ts --yes` (couvre les compagnons via C1_IMPROVEMENT_TARGETS).

### 2.3 — Extraction + persistance canonique
- `lib/pdf-forms/canonical/extract.ts` : `extractCanonical(fields, payload): Record<CanonicalKey, FieldValue>` (pur) et `canonicalToPrefill(fields, canonical): Record<string, string>` (mappe vers les ids du formulaire CIBLE via son propre canonicalKey).
- **Stockage** : lire d'abord le modèle du bundle run (`prisma/schema.prisma`, grep BundleRun / bundle session). S'il existe une colonne JSON réutilisable, l'utiliser. Sinon SQL ADDITIF :
  ```sql
  ALTER TABLE "BundleRun" ADD COLUMN IF NOT EXISTS "canonicalData" JSONB;
  ```
  (adapter le nom réel de la table ; mettre à jour schema.prisma ; `prisma generate` dev server ARRÊTÉ).
- **Écriture** : dans l'endpoint draft (`app/api/pdf/[slug]/draft` POST) ET au submit generate : si la requête porte un bundleRunId, extraire le canonique du payload et merger dans `canonicalData` (les valeurs non vides écrasent).
- **Lecture** : dans `app/d/[slug]/page.tsx` (ou là où les formulaires compagnons sont ouverts — suivre le flux `collectAllTriggeredSlugs` → ouverture compagnon) : charger canonicalData du run, `canonicalToPrefill(fieldsDuCompagnon, canonical)`, merger dans le `bundlePrefill` existant. **Priorité** : bundlePrefill explicite (wizard) > canonique > prefill profil.

### 2.4 — Tests
- extract/canonicalToPrefill purs (aller-retour C1 → C1A).
- Test de complétude : chaque seed compagnon a AU MOINS identity.nom/prenom/niss mappés (test qui itère les seeds).

**Commit 3** : vocabulary + canonicalKey sur tous les seeds + tests. **Commit 4** : persistance + prefill croisé + test manuel prod (remplir C1 → déclencher C1A → vérifier pré-remplissage).

---

## Phase 3 — URLs `/document/onem/c1` (SEO + stabilité)

**Décision Oraliks** : `/document/c1-changement-situation` → `/document/onem/c1`. Le `publicPath` découple l'URL du slug interne : si le slug change, l'URL publique reste stable.

### 3.1 — Colonne `publicPath`
```sql
ALTER TABLE "PdfForm" ADD COLUMN IF NOT EXISTS "publicPath" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PdfForm_publicPath_key" ON "PdfForm"("publicPath") WHERE "publicPath" IS NOT NULL;
```
via `db execute` + màj `schema.prisma` (`publicPath String? @unique`) + `prisma generate` (dev server arrêté).

### 3.2 — Attribution
```sql
UPDATE "PdfForm" SET "publicPath" = 'onem/c1' WHERE slug = 'c1-changement-situation';
```
⚠️ **Point de décision Oraliks** avant d'attribuer les autres : proposer `onem/c1-demande` (slug `c1`), `onem/c1-insertion`, `onem/c1a`, `onem/c1b`, `onem/c1c`, `onem/c46`, `onem/c47`, `onem/c1-partenaire`, `onem/annexe-regis` — mais NE PAS exécuter sans son OK (risque de collision sémantique c1 vs c1-changement).

### 3.3 — Routing
- Transformer `app/document/[slug]/page.tsx` en `app/document/[...path]/page.tsx` :
  - 1 segment → lookup par slug ; si le form a un publicPath → `permanentRedirect('/document/' + publicPath)` (308) ; sinon rendre normalement (compat).
  - 2 segments → lookup par publicPath (join "/") ; rendre. 404 sinon.
- `/pdf/[slug]` (redirect legacy existant) : pointer vers la résolution ci-dessus (inchangé, il redirige vers /document/slug qui re-redirige — chaîne acceptable, ou résoudre directement le publicPath).
- `generateMetadata` : `alternates.canonical` = URL publicPath.
- Sitemap (`app/sitemap.xml` ou équivalent — le localiser) : émettre les URLs publicPath.
- Admin : champ « URL publique » éditable dans l'éditeur de formulaire PDF admin (`/admin/pdf/[id]`) + clés i18n fr/nl/en.

### 3.4 — Vérification
`curl -sI https://www.docbel.be/document/c1-changement-situation | grep -i location` → `/document/onem/c1` (308). L'ancienne URL doit rediriger, pas 404 (des liens existent déjà).

**Commit 5** : SQL + schema + routing + canonical meta + sitemap. **Commit 6** : champ admin + i18n.

---

## Phase 4 — Version mobile compacte

**Demande** : « réduire le texte tout en gardant la même nature ».

### 4.1 — `labelShort` / `helpShort`
- `types.ts` : `labelShort?: Localized; helpShort?: Localized;` sur PdfFormField + serializer.
- Rendu SANS hook media-query (pas de flicker hydratation) : dans `LabelWithTooltip` (pdf-field.tsx) et les chips/OptionCard :
  ```tsx
  {labelShort ? (<><span className="sm:hidden">{labelShort}</span><span className="hidden sm:inline">{label}</span></>) : label}
  ```
- Seeder les labelShort pour le C1 changement — cibler les libellés > ~40 caractères :
  - « Ma situation personnelle ou celle des membres de mon ménage a changé » → « Ma situation de ménage a changé »
  - « Mon permis de séjour ou mon permis de travail a changé » → « Mon permis a changé »
  - « Je transfère mon dossier vers un autre organisme de paiement » → « Je change d'organisme de paiement »
  - « Chômeur temporaire suivant une formation en alternance » → « Chômeur temporaire en alternance »
  - « Ta situation de cohabitation est ambiguë (registre national / réalité de ménage divergents) ? » → « Cohabitation ambiguë ? »
  - Les 3 affirmations sur l'honneur → versions courtes (garder le sens légal : « Je déclare sur l'honneur que tout est exact », « J'ai lu la feuille d'info C1 », « Je signalerai tout changement »)
  - ⚠️ Faire VALIDER la liste des libellés courts par Oraliks avant de seeder (corrections UI terses : interpréter minimal, ne jamais supprimer un champ officiel).
- Compactage layout mobile (`pdf-form-runner.tsx`) : paddings `p-3` sous sm, `gap-y-3`, sections en 1 colonne (déjà le cas), vérifier le stepper mobile (déjà retravaillé commit 2d2c7d1 — ne pas casser).

### 4.2 — Validation
Dev server + `preview_resize` 375×812 + `preview_snapshot` sur les 5 steps (PAS preview_screenshot — timeout connu). Vérifier aucun overflow horizontal.

**Commit 7** : types + rendu + seeds labelShort + re-apply DB.

---

## Phase 5 — Bouton « Recommencer » (reset)

- **UI** : bouton discret dans le footer du runner, à côté de la ligne « Vos réponses sont enregistrées automatiquement » (AutoSaveNotice) : `variant="ghost" size="sm"` + icône `RotateCcwIcon` + texte `text-xs text-muted-foreground`.
- **Confirmation** : `AlertDialog` shadcn — titre « Réinitialiser le formulaire ? », description « Toutes tes réponses seront effacées et le brouillon supprimé. Cette action est irréversible. », bouton destructif « Tout effacer ».
- **Action onConfirm** :
  ```ts
  await fetch(`/api/pdf/${form.slug}/draft`, { method: "DELETE" }).catch(() => {});
  setValues(defaultValues(form, bundlePrefill));  // ré-applique defaults + system.today + bundlePrefill
  setErrors({}); setConsent(false); setActive(0);
  toast.success(t("runnerResetDone"));
  ```
- **i18n** : `runnerResetButton` (« Recommencer »), `runnerResetTitle`, `runnerResetDesc`, `runnerResetConfirm`, `runnerResetDone` dans `messages/{fr,nl,en}.json` (section public.dossier) + `pnpm i18n:check`.
- ⚠️ Ne PAS réinitialiser la locale ni le mode delivery.

**Commit 8** : bouton + dialog + i18n. Test manuel : remplir 2 steps → reset → vérifier step 1, valeurs par défaut, brouillon supprimé (recharger la page → pas de toast « Brouillon restauré »).

---

## Phase 6 — Admin : visualiseur de mapping AcroForm

**Demande** : « chaque document créé, on peut voir les acroforms, ils sont liés à quel input ou autres, pour pouvoir corriger ».

### 6.1 — `lib/pdf-forms/mapping-report.ts` (pur, testé)
```ts
export interface WidgetClaim {
  source: "field" | "pipe-option" | "array-template" | "first-match" | "rule" | "extra-stamp";
  fieldId?: string; fieldLabel?: string; ruleName?: string; detail?: string;
}
export interface WidgetReportRow {
  pdfFieldName: string; acroType: string; page: number;
  rect?: [number, number, number, number]; maxLen?: number;
  claims: WidgetClaim[];
  status: "bound" | "orphan" | "conflict";   // conflict = 2+ claims de sources différentes sur un widget texte
}
export function buildMappingReport(
  fields: PdfFormField[], technicalSchema: AcroFieldRaw[], rules: MappingRule[]
): WidgetReportRow[]
```
Résolution des claims (réutiliser les patterns de `collectCoveredPdfNames` + `expandTemplate` de c1-fields-improvements.ts) :
1. `field.pdfFieldName` direct (split sur `|` → une claim `pipe-option` par segment, avec l'option correspondante en detail)
2. `array` : `pdfFieldNameTemplate` étendu 1..maxRows + `firstMatchMapping.fields`
3. Règles du registry : StampEntry statiques → claim `rule` ; `stampFn` → exécuter sur un payload d'exemple ? NON — trop fragile. À la place : convention `declaredWidgets?: string[]` optionnelle sur MappingRule pour les stampFn (les règles à stampFn listent leurs widgets cibles ; les règles à stamp statique n'en ont pas besoin). Ajouter ce champ en Phase 1.
4. Widgets du technicalSchema sans aucune claim → `orphan`.

### 6.2 — UI `/admin/pdf/[id]` — onglet « Mapping AcroForm »
- Localiser le composant page admin PDF existant (tabs) ; ajouter un onglet.
- Header : compteurs (widgets total / liés / orphelins / conflits).
- Table filtrable (« orphelins », « conflits », recherche texte) : widget | type (badge) | page | maxLen | lié à (label + fieldId cliquable) | source (badge : schéma / pipe / array / règle / —).
- Clic sur « lié à » → ouvre l'accordéon du champ dans l'éditeur (les items utilisent `value={field.id}` dans field-editor.tsx — passer par l'état d'accordéon ou un anchor).
- Orphelins en ambre, conflits en rouge.
- i18n fr/nl/en pour les libellés de l'onglet.
- v2 OPTIONNELLE (ne faire que si le reste est livré) : bouton « réassigner » sur un orphelin → dropdown des champs → écrit pdfFieldName.

### 6.3 — Tests
`mapping-report.test.ts` sur les données C1 réelles (fields du seed + technicalSchema d'un dump) : 0 conflits attendus, orphelins = ensemble connu (junk du template). Snapshot des counts.

**Commit 9** : mapping-report + tests. **Commit 10** : onglet admin + i18n.

---

## Phase 7 — Bascule finale + nettoyage

⚠️ Uniquement après validation PROD des phases 1-2 (Oraliks génère un PDF réel correct).

1. Retirer les 6 imports+appels transforms du runner (`submit()` ne garde que `applyFieldDerivations` + la boucle signature/system.today).
2. Supprimer les 6 fichiers `c1-motif-transfer.ts`, `c1-iban-routing.ts`, `c1-remarque-derivation.ts`, `c1-titulaire-derivation.ts`, `c1-iban-split.ts`, `c1-date-header-p2.ts` + leurs tests → équivalents déjà couverts par les tests bindings.
3. Supprimer du schéma les champs workaround (liste §0) + `pnpm tsx scripts/apply-c1-improvements.ts --yes`.
4. Étendre le registry aux slugs `c1` et `c1-insertion` (composer une base commune famille C1 + variantes).
5. Compagnons : règles + identityBindings pour c1a/c1b/c1c/c46/c47/c1-partenaire/c1-regis (1 commit par document, avec dump AcroForm de chacun via une variante de scripts/dump-c1.ts).
6. `docs/context/PROJECT_INDEX.md` + `AGENTS.md` : documenter le système bindings (3 couches, où ajouter une règle).

**Validation finale globale** :
```bash
pnpm vitest run          # tout vert
rm -rf .next && pnpm build
pnpm i18n:check
pnpm tsx scripts/apply-c1-improvements.ts --yes
# push → attendre nouveau dpl_ sur docbel.be → submit réel avec le brouillon d'Oraliks
```

---

## Points de décision à poser à Oraliks (NE PAS trancher seul)
1. publicPath des autres formulaires (§3.2) — seul `onem/c1` est validé.
2. Libellés courts mobiles (§4.1) — proposer la liste, attendre le OK.
3. Ordre de migration des compagnons en Phase 7 (suggérer : c1-regis d'abord — déclenché par colocation, flux le plus fréquent).
4. La règle `hors-eee-non` se déclenche sur `nationaliteHorsEEE === "non"` (question explicite du formulaire), PAS sur le champ texte libre `nationalit_3` — confirmé pendant la session, ne pas "améliorer" en parsant la nationalité texte.
   **MàJ 2026-07-08 (Oraliks) : décision inversée pour l'UX du formulaire** (pas pour la règle de stamping ci-dessus, qui reste inchangée). `nationaliteHorsEEE` est maintenant `derivedFrom: nationalit_3` (verrouillé, cf. `lib/pdf-forms/nationalite-eee.ts` + `field-derivations.ts#nationalite-hors-eee`) : le texte libre EST parsé pour pré-cocher/verrouiller ce toggle, malgré le risque de faux positif documenté dans nationalite-eee.ts. La règle `hors-eee-non` elle-même continue de se déclencher sur la VALEUR de `nationaliteHorsEEE` (qui peut désormais provenir de la dérivation plutôt que d'un clic manuel) — aucun changement dans `hors-eee-triple-non.ts`.

## Ce qui est HORS périmètre (ne pas entamer sans demande)
- Renommage des champs AcroForm dans les PDFs sources (rejeté : casse la traçabilité ONEM — l'alias table EST la solution).
- `dateModificationEffective` en drawText positionnel sur les 3 slots dates du motif (widgets inexistants dans le template — tâche #29 en attente, complexe, à part).
- Refonte des dossiers/bundles au-delà du prefill canonique.
