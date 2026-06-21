# Conventions i18n — Beldoc

> **Pour qui :** tout dev *et* toute session Claude Code. À lire avant d'écrire la moindre UI.
> **But :** chaque nouvelle feature est **i18n-ready par défaut**. On ne « rajoutera pas l'i18n plus tard ».
> **Stack :** `next-intl` en **mode cookie** (pas de `/fr/` dans l'URL). Source = `messages/fr.json`. Les autres locales retombent sur FR automatiquement (deep-merge dans `i18n/request.ts`). 8 langues figées dans `i18n/config.ts`.

---

## 0. Règle d'or

**Zéro string user-facing en dur.** Tout texte visible à l'écran passe par next-intl. Pas de `"Enregistrer"` dans le JSX, pas de message d'erreur littéral, pas de placeholder en dur, pas de toast codé en français.

```tsx
// ❌ JAMAIS
<Button>Enregistrer</Button>
toast.error("Impossible d'enregistrer")

// ✅ TOUJOURS
<Button>{t("save")}</Button>
toast.error(t("saveError"))
```

Seules exceptions tolérées : noms propres (`"Docbel"`, `"ONEM"`), libellés purement techniques jamais montrés à l'utilisateur. En cas de doute → clé i18n.

---

## 1. `t()` — client vs serveur

**Composant client** (`"use client"`) :

```tsx
"use client"
import { useTranslations } from "next-intl"

export function UserTable() {
  const t = useTranslations("admin.users")
  return <h1>{t("title")}</h1>   // → "Utilisateurs"
}
```

**Composant serveur** (async, pas de `"use client"`) :

```tsx
import { getTranslations } from "next-intl/server"

export default async function Page() {
  const t = await getTranslations("admin.users")
  return <h1>{t("title")}</h1>
}
```

`useTranslations` côté client est **synchrone** ; `getTranslations` côté serveur est **`await`**. C'est la seule différence.

---

## 2. Namespaces

Un namespace = une section. On passe le préfixe à `useTranslations` / `getTranslations`, puis des clés courtes.

| Zone | Namespace | Exemple |
|---|---|---|
| Admin | `admin.<section>` | `admin.users`, `admin.news`, `admin.baremes` |
| Navigation admin | `admin.nav` | libellés de la sidebar |
| Boutons génériques | `admin.common` | `save`, `cancel`, `delete`, `edit`, `create`, `search`, `loading`, `confirm`, `back`, `close`, `yes`, `no` |
| Public (à venir) | `<feature>` | `home`, `monDossier`, `actualites` (pas de préfixe `admin.`) |

**Réutilise `admin.common.*`** pour les actions génériques au lieu de redéfinir un `save` par section :

```tsx
const t = useTranslations("admin.users")
const tc = useTranslations("admin.common")
// ...
<Button>{tc("cancel")}</Button>
<Button>{t("createUser")}</Button>
```

**Ajouter une clé** = l'écrire dans `messages/fr.json` (la **source**). Inutile de toucher `nl.json`, `de.json`, etc. : une clé absente d'une locale retombe sur la valeur FR (deep-merge). On ne traduit les autres langues que via le pipeline dédié.

---

## 3. Clés

- **camelCase**, court, **sémantique** (décrit le rôle, pas le texte) : `saveDraft`, `errEmailRequired`, `colCreatedAt`, `toastPublished`.
- Préfixes conventionnels déjà en place : `col*` (colonnes de table), `toast*` (toasts), `err*`/`error*` (validation), `stat*`/`kpi*` (chiffres), `filter*`, `placeholder*`.
- Pas de clés-phrases (`"clicHereToSave"`), pas de clés numérotées (`label1`, `label2`).

---

## 4. ICU — pluriels, variables, sélection

Interpolation simple :

```jsonc
// fr.json
"savedAt": "Sauvegardé à {time}"
```
```tsx
t("savedAt", { time })
```

**Pluriel** (toujours via ICU, jamais un `if (n > 1)` en JS) :

```jsonc
"rowsCount": "{count, plural, =0 {# utilisateur} =1 {# utilisateur} other {# utilisateur(s)}}"
```
```tsx
t("rowsCount", { count })   // le # est remplacé par la valeur
```

**Sélection** (enum → libellé) :

```jsonc
"status": "{status, select, published {Publié} draft {Brouillon} scheduled {Planifié} other {Archivé}}"
```
```tsx
t("status", { status: article.status })
```

**Accolades littérales** (afficher un token `{xxx}` sans l'interpréter) → les encadrer de quotes simples ICU :

```jsonc
"emailBodyDescription": "Le lien doit apparaître via '{{'confirmationLink'}}'."
```

---

## 5. Dates & nombres — JAMAIS de locale en dur

**Interdit :** `date.toLocaleDateString('fr-BE')`, `n.toLocaleString('fr-BE')`, `new Intl.NumberFormat('fr-BE', …)`. Ça fige le français pour les 8 langues.

Utilise les helpers de **`lib/i18n/format.ts`** en leur passant la **locale active** :
`formatDate`, `formatDateTime`, `formatNumber`, `formatCurrency` (EUR par défaut). Chacun dérive le bon tag BCP-47 belge (`fr-BE`, `nl-BE`, …) et retourne `""` sur entrée invalide.

```tsx
// CLIENT
"use client"
import { useLocale } from "next-intl"
import { formatDate, formatCurrency } from "@/lib/i18n/format"

const locale = useLocale()
formatDate(dossier.createdAt, locale)        // 22/06/2026 en fr, 22-06-2026 en nl…
formatCurrency(montant, locale)              // 1 234,56 € selon la locale
```

```tsx
// SERVEUR
import { getLocale } from "next-intl/server"
import { formatDateTime } from "@/lib/i18n/format"

const locale = await getLocale()
formatDateTime(log.createdAt, locale)
```

> `useFormatter()` / `getFormatter()` de next-intl restent valables pour le formatage déclaratif dans un composant ; les helpers ci-dessus couvrent le cas impératif (valeur brute, hors contexte React).

---

## 6. Nouveau modèle DB traduisible

Un champ texte affiché à l'utilisateur (label, titre, description…) **ne se stocke pas en colonne FR brute**. Suis le pattern de `docs/i18n-implementation-plan.md` pour être multilingue dès la création :

- **Label court** (Tool, Category, Organisme, preset…) → table générique **`ContentTranslation`** `(model, recordId, field, locale, value, status)`.
- **Contenu riche** (article, page, changelog) → table dédiée **`<Model>Translation`** (ex. `NewsTranslation`) avec colonnes typées + `content` JSON.
- **Labels dans un schéma JSON** (DocumentTemplate.schema, PdfForm.fields) → objet `{ fr, nl, … }` **dans** le JSON (pattern `PdfFieldPreset`).
- **Lookup ONEM** → exception, colonnes `labelFr/Nl/De` **existantes**.

Toujours un **fallback FR** à la lecture (`locale → fr`), jamais d'écran vide.

> 🚨 DB Neon **partagée** : migration **additive + idempotente** (`CREATE TABLE / ADD COLUMN IF NOT EXISTS`) via `prisma db execute`. **Jamais `db push`** (détruit pgvector + tables PDF).

---

## 7. Avant un commit / une PR

Lance la validation i18n :

```bash
pnpm i18n:check    # validation ICU + couverture des clés
```

Les clés sont **typées** (`i18n/global.ts` augmente les types next-intl à partir de `fr.json`) : une clé absente ou une typo **casse `tsc`** — pas besoin d'attendre le runtime. Si `tsc` est vert et `i18n:check` est vert, l'i18n de la feature tient.

> ⚠️ État actuel : `i18n/global.ts` (clés typées) et le script `i18n:check` sont la convention **cible**. S'ils ne sont pas encore branchés sur ta base, ne contourne pas la règle — câble-les (typage à partir de `messages/fr.json`) plutôt que de t'en passer.

---

## 8. Definition of Done (i18n) — checklist

- [ ] **Zéro string user-facing en dur** (UI, erreurs, toasts, placeholders, libellés enum).
- [ ] Toutes les clés ajoutées dans **`messages/fr.json`** (source), bon namespace, `admin.common.*` réutilisé pour les génériques.
- [ ] Pluriels / variables / enums en **ICU** (pas de logique de pluriel en JS).
- [ ] Dates & nombres via **`lib/i18n/format.ts`** + locale active (zéro `'fr-BE'` en dur).
- [ ] Champs DB traduisibles branchés sur **`ContentTranslation` / `*Translation`** (pas de colonne FR brute), fallback FR.
- [ ] **`pnpm i18n:check` vert** + `tsc` vert.
