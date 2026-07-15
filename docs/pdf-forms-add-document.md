# Ajouter un nouveau document ONEM (playbook)

Guide pas-à-pas pour intégrer un formulaire PDF officiel (typiquement un
document ONEM) dans DocBel : depuis le PDF source jusqu'à la publication.
Chaque étape indique commande + fichier + garde-fou associé.

> Prérequis : le PDF source doit être **plat** (pas de sécurité, pas de
> chiffrement). Testé avec les documents ONEM v01.2024. Si le PDF n'a pas
> d'AcroForm ou est corrompu, l'inférence renverra 0 widget.

## Choisir le mode du dossier

Deux modes coexistent volontairement :

- **Mode no-code** : dossier créé dans `/admin/pdf/dossiers`. Les métadonnées,
  documents, conditions, questions et avertissements enregistrés en base sont
  directement servis au citoyen.
- **Mode avancé** : le slug est enregistré dans `lib/dossiers/registry.ts`. Le
  questionnaire et les règles d'applicabilité viennent alors du module
  `lib/dossiers/<slug>/index.ts` et sont affichés en lecture seule dans l'admin.

Utiliser le mode avancé uniquement lorsqu'il faut des responsabilités tierces,
un parcours d'introduction, de la théorie/procédure ou une logique métier qui ne
peut pas être exprimée par l'arbre de conditions no-code.

---

## 1. Déposer le PDF source

Copier le fichier dans `private/pdfs/` en gardant la convention de nommage
existante : `<SIGLE>_FR.pdf` (ex. `C109-36_Demande_FR.pdf`).

```bash
cp ~/Downloads/nouveau-doc.pdf private/pdfs/C109-36_Demande_FR.pdf
```

⚠ `private/pdfs/` est ignoré par git (cf. `.gitignore`) — le PDF n'entre
pas dans le repo. Il doit être partagé hors-git avec les autres devs.

---

## 2. Dumper l'AcroForm pour explorer les widgets

Le script généralisé `scripts/dump-pdf-widgets.ts` accepte un nom de
fichier ou `--all` pour tout dumper.

```bash
# Un seul document
pnpm tsx scripts/dump-pdf-widgets.ts C109-36_Demande_FR

# Tous les PDFs de private/pdfs/
pnpm tsx scripts/dump-pdf-widgets.ts --all
```

Sortie : `<tmpdir>/beldoc-pdf-widgets/<base>-widgets.txt` avec chaque
widget, sa page, sa position (x,y), son maxLen et son tooltip (/TU).

Repérer :
- Widgets identité (Nom, NISS, adresse) → seront tagués `canonicalKey`
- Widgets paires oui/non → convention `pdfFieldName: "oui|non"` avec type
  radio
- Widgets composites (« Nom et prénom » en un slot) → auto-composition
  côté canonical prefill si type `fullname`
- Widgets IBAN belge split en 4 slots → règle serveur `iban-be-split`
- Widgets « junk » cryptiques (undefined_N, TexteN) → à masquer via
  curation

---

## 3. Créer le seed enrichi

Créer `lib/pdf-forms/seed/<slug>-fields.ts` sur le modèle des seeds
existants (`c1a-fields.ts` est un bon point de départ). Chaque champ =
un `PdfFormField` avec au minimum `id`, `pdfFieldName`, `type`, `label`.

**Tagger `canonicalKey`** dès qu'un champ correspond à une clé du
vocabulaire canonique (`lib/pdf-forms/canonical/vocabulary.ts`) : nom,
prénom, NISS, adresse, contact, banque, statut famille. Sans ça, le
pré-remplissage automatique cross-document ne fonctionnera pas.

```ts
{
  id: "niss",
  pdfFieldName: "NISS",
  type: "niss",
  required: true,
  label: { fr: "Numéro NISS (registre national)" },
  canonicalKey: "identity.niss",       // ← auto-prefill inter-documents
  prefillFrom: "profile.niss",
  section: SECTION_IDENTITE,
  order: -100,
},
```

⚠ Les champs `type: "fullname"` reçoivent AUTOMATIQUEMENT prénom+nom
depuis les autres formulaires du run — inutile de leur poser un
`canonicalKey` (auto-composition via `identity.prenom`/`identity.nom`).

---

## 4. Écrire (si nécessaire) une fonction d'improve + apply script

Si le PDF a des widgets « junk » à masquer, des paires radio à unifier,
ou des overrides métier (motif restrictif, labels courts…), créer une
fonction `apply<Slug>Improvements(fields)` sur le modèle
`applyC1Improvements`. La déclarer dans
`lib/pdf-forms/seed/apply-c1-improvements-core.ts#C1_IMPROVEMENT_TARGETS`
et créer un script CLI si tu veux l'appliquer indépendamment (cf.
`scripts/apply-c1-improvements.ts`).

---

## 5. Importer le PDF via l'admin

Via l'interface `/admin/pdf/new` → uploader le fichier (le même déposé en
étape 1) → un `PdfForm` en `status: "draft"` est créé avec les champs
inférés automatiquement.

Alternative CLI : `scripts/scaffold-pdf-form.ts <fichier>` (cf. #1 des
améliorations).

---

## 6. Appliquer les améliorations du seed en DB

```bash
pnpm tsx scripts/apply-c1-improvements.ts --yes
```

Ce script itère les cibles `C1_IMPROVEMENT_TARGETS` et met à jour le
champ `fields` (JSON) du `PdfForm` en base. Idempotent — ré-exécutable
sans dupliquer.

⚠ Chaque édition de seed doit être suivie d'un apply — sinon la DB de
prod dérive du code (le sub-check du feature #3 « diff seed ↔ DB »
détecte ça).

---

## 7. Écrire les règles serveur (si widgets composites / dérivés)

Si le PDF a des widgets qui reçoivent une valeur DÉRIVÉE de plusieurs
champs (ex. IBAN belge split en 4 groupes, remarque famille concaténée,
date en-tête page 2), créer `lib/pdf-forms/bindings/per-form/<slug>.ts`
sur le modèle de `c1-changement.ts`.

Chaque règle = un objet `MappingRule` avec `when` (conditions
déclaratives) et `stamp` ou `stampFn`. Cf. `lib/pdf-forms/bindings/README`
(ou lire `c1-changement.ts` pour les 13 règles-exemples).

Enregistrer le slug dans `lib/pdf-forms/bindings/registry.ts` :

```ts
const RULES_BY_SLUG: Record<string, MappingRule[]> = {
  // ...
  "c109-36-demande": C109_36_DEMANDE_RULES,
};
```

---

## 8. Configurer les paramètres admin

Dans `/admin/pdf/<id>` → onglet Paramètres :
- **Titre** : « C109/36 Demande » (nom user-facing)
- **Organisme émetteur** : ONEM
- **URL publique (SEO)** : ex. `onem/c109-36-demande` — un feedback ✓/✗
  live indique si l'URL est disponible (feature #9)
- **Langues** : FR obligatoire, ajouter NL/DE si traduit
- **Modes de livraison** : téléchargement direct par défaut ; Doccle si
  configuré

Sauver.

---

## 9. Valider le mapping AcroForm

Onglet **Mapping AcroForm** de l'éditeur admin :
- Compteurs `bound` / `orphan` / `conflict` en haut
- **Orphans** = widgets sans stamping (case blanche sur le PDF généré) —
  à masquer ou à mapper via un champ/règle
- **Conflicts** = widget stampé par 2+ sources hétérogènes — à
  arbitrer (dernier gagnant du resolveStamps, mais souvent signe d'un
  copy/paste)

Le pré-publish check refuse un formulaire avec trop d'orphelins
(feature #10).

---

## 10. Tester une génération réelle

Bouton **Tester** en haut de l'éditeur → génère un PDF avec un payload
d'exemple → télécharge. Ouvrir dans un lecteur PDF et vérifier :
- Aucun champ blanc que tu voulais rempli
- Aucun stamp mal positionné
- Format des dates (DD/MM/YYYY)
- IBAN belge : préfixe BE présent statiquement + 14 chiffres alignés

Alternative : sauvegarder un **fixture de test** (feature #8) et générer
depuis le fixture — utile pour non-régression.

---

## 11. Publier

Onglet **Publication** → cliquer sur « Publier ». La check-list de
publication vérifie :
- Tous les champs required ont un label
- La sanitation des champs a réussi
- Aucune erreur bloquante dans le mapping AcroForm

Une fois publié, le PDF est accessible :
- Par slug interne : `/document/<slug>` (redirection 308 vers publicPath
  si posé)
- Par URL publique : `/document/<publicPath>` (canonique SEO)
- Depuis un dossier bundle : `/d/<dossier-slug>` (si linké dans un
  `DocumentBundle`)

---

## Checklist express

- [ ] PDF dans `private/pdfs/<slug>_FR.pdf`
- [ ] Widgets dumpés et compris
- [ ] Seed enrichi avec `canonicalKey` sur les champs identité
- [ ] `apply-c1-improvements.ts --yes` exécuté
- [ ] Règles serveur (si widgets composites/dérivés) écrites +
      registrées
- [ ] publicPath assigné + validé ✓ live
- [ ] Onglet Mapping AcroForm ne montre pas de conflict rouge
- [ ] Bouton Tester → PDF réel correct
- [ ] Publier

---

## Références

- `docs/context/PROJECT_INDEX.md` — carte des couches (bindings /
  canonical / mapping-report / publicPath)
- `AGENTS.md` § « PDF Forms bindings » — 3 couches à ne pas confondre
- `lib/pdf-forms/bindings/per-form/c1-changement.ts` — 13 règles-exemples
- `lib/pdf-forms/seed/c1-fields-improvements.ts` — le seed le plus riche
  (~2000 l.)

---

## Améliorations futures (à discuter avant implémentation)

**Éditeur no-code de règles serveur dans l'admin** — actuellement les
règles vivent en TypeScript (`bindings/per-form/<slug>.ts`) + registry.
Un éditeur admin qui persiste des règles en DB (colonne `PdfForm.customRules`)
et les fusionne runtime avec les règles code (`getRulesForSlug`) émanciperait
90% des cas simples (« stamp widget X quand champ Y = valeur Z ») du besoin
de dev. Complexité : réécrire un UI de règles when/stamp + assurer la
sérialisation JSON compatible avec le moteur pur.

**Système de variantes / overlay** — quand on veut copier C1 en
c1-insertion avec quelques différences (nouveau motif par défaut, une
règle changée), aujourd'hui il faut dupliquer le seed complet + apply
séparé. Un mécanisme `PdfForm.parentSlug` + `overlayFields` qui compose
runtime le parent + les overrides éviterait la duplication. Nécessite
un refactor du serializer + du filler + du publish-checks pour composer
en cascade.

Ces deux features attendent une session avec Oraliks pour valider les
choix de design (structure du JSON custom-rules, résolution des
conflits parent/overlay) avant implémentation — le coût de refactorer
un mauvais choix est élevé sur le pipeline PDF.
