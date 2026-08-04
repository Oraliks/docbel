# Aperçu du PDF rempli Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur l'écran « Mes documents », ajouter un bouton Aperçu à côté de
Revoir/Télécharger pour chaque document déjà validé : il ouvre le PDF
réellement rempli dans un nouvel onglet, sans forcer de téléchargement.

**Architecture:** Un paramètre `?inline=1` sur la route existante
`GET /api/bundles/runs/[runId]/download/[pdfFormId]` (chantier 1) bascule
`Content-Disposition: attachment` → `inline` et supprime l'émission de
l'event `documents_downloaded` (un aperçu n'est pas une fin de parcours). Le
bouton est un simple lien `<a target="_blank">`, aucun JS, aucune dépendance.
Spec validée : `docs/superpowers/specs/2026-08-04-apercu-pdf-mes-documents-design.md`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict,
next-intl 4.

## Global Constraints

- **Aucune nouvelle dépendance, aucune migration DB.**
- Le paramètre `inline` est **read-only** sur la route : ne touche à aucune
  écriture existante (verrou dossier, propriété du run, log de soumission —
  tous inchangés).
- **Pas de nouvel événement analytics** en V1 — l'aperçu ne déclenche
  simplement pas `documents_downloaded`.
- `git add` de chemins **explicites** uniquement (workdir partagé
  multi-agents). Jamais `git add -A`.
- `pnpm lint` a ~129 erreurs préexistantes : **zéro nouvelle erreur**.
- Front public : tokens glass, jamais `bg-white`/`#FFFFFF` en dur (aucun
  nouveau style ici — le bouton réutilise `<Button variant="outline">` déjà
  utilisé pour « Revoir »).
- `fr.json` est en **CRLF** : insertion chirurgicale (Edit court), jamais de
  réécriture de fichier. `bg.json`/`ro.json` n'ont pas de section
  `public.dossier` (locales partielles, repli FR déjà établi au chantier 1) —
  ne pas y créer de clé orpheline.
- Pas de patron de test HTTP existant sur les routes `app/api/bundles/*`
  (aucun `__tests__` dans cet arbre) : suivre l'existant, valider par
  build + lint + QA manuelle plutôt que d'introduire un premier test de route
  isolé pour deux lignes de logique.
- Commandes de validation : `pnpm build` · `pnpm lint` · `pnpm i18n:check`.

---

### Task 1: Paramètre `inline` sur la route de téléchargement individuel

**Files:**
- Modify: `app/api/bundles/runs/[runId]/download/[pdfFormId]/route.ts`

**Interfaces:**
- Consumes: rien de nouveau (route déjà existante, mêmes imports).
- Produces: `GET .../download/[pdfFormId]?inline=1` → même PDF, header
  `Content-Disposition: inline`, **sans** l'event `documents_downloaded`.
  `GET .../download/[pdfFormId]` (sans le paramètre) → comportement
  strictement inchangé. Consommé par la Task 2 (lien du bouton).

- [ ] **Step 1: Lire le paramètre et conditionner l'event + le header**

Dans `app/api/bundles/runs/[runId]/download/[pdfFormId]/route.ts`, juste après
`const { runId, pdfFormId } = await params;` :

```ts
  // Aperçu (chantier 3, écran Mes documents) : ?inline=1 affiche le PDF dans
  // le viewer natif du navigateur au lieu de forcer un téléchargement. Un
  // aperçu n'est pas une fin de parcours — l'event documents_downloaded (qui
  // alimente le funnel « Parcours ») n'est émis QUE sans ce paramètre.
  const inline = req.nextUrl.searchParams.get("inline") === "1";
```

Remplacer le bloc de tracking :

```ts
  await trackBundleEvent("documents_downloaded", {
    sessionId,
    userId,
    metadata: { bundleSlug: state.run.bundleSlug, via: "download-one" },
  });
```

par :

```ts
  if (!inline) {
    await trackBundleEvent("documents_downloaded", {
      sessionId,
      userId,
      metadata: { bundleSlug: state.run.bundleSlug, via: "download-one" },
    });
  }
```

Puis remplacer le header de réponse :

```ts
  return new NextResponse(new Uint8Array(result.doc.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.doc.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
```

par :

```ts
  return new NextResponse(new Uint8Array(result.doc.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${result.doc.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
```

- [ ] **Step 2: Vérifier la compilation**

Run: `pnpm build`
Expected: build OK, aucune erreur de type sur la route modifiée.

- [ ] **Step 3: Commit**

```bash
git add "app/api/bundles/runs/[runId]/download/[pdfFormId]/route.ts"
git commit -m "feat(pdf-forms): paramètre ?inline=1 sur le téléchargement individuel (aperçu sans event)"
```

---

### Task 2: Bouton Aperçu dans `BundleRoadmap`

**Files:**
- Modify: `components/docbel/bundle-roadmap.tsx`
- Modify: `messages/fr.json`, `messages/nl.json`, `messages/de.json`,
  `messages/en.json`, `messages/es.json`, `messages/it.json`,
  `messages/pt.json`, `messages/ru.json`, `messages/tr.json`,
  `messages/ar.json`, `messages/mk.json`, `messages/sq.json`
  (`bg.json`/`ro.json` sautées — pas de section `public.dossier`)

**Interfaces:**
- Consumes: route de la Task 1 (`?inline=1`), icône `Eye` (`lucide-react`).
- Produces: rien de nouveau exposé — point d'application final de ce lot.

- [ ] **Step 1: Ajouter l'icône `Eye` aux imports**

Dans `components/docbel/bundle-roadmap.tsx`, le bloc d'import `lucide-react`
actuel liste `Archive, Download, ExternalLink, Landmark, ListChecks, Mail,
Paperclip, Printer, ShieldAlert, Signature` — y ajouter `Eye` (ordre
alphabétique du bloc existant) :

```ts
import {
  Archive,
  Download,
  Eye,
  ExternalLink,
  Landmark,
  ListChecks,
  Mail,
  Paperclip,
  Printer,
  ShieldAlert,
  Signature,
} from "lucide-react";
```

- [ ] **Step 2: Ajouter le bouton Aperçu avant le bouton Télécharger**

Localiser dans le même fichier le bloc (à l'intérieur de `documents.map`) :

```tsx
                {bundleRunId ? (
                  <Button
                    render={
                      <a
                        href={`/api/bundles/runs/${bundleRunId}/download/${document.pdfFormId}`}
                      />
                    }
                    nativeButton={false}
                    size="sm"
                  >
                    <Download data-icon="inline-start" aria-hidden />
                    {t("roadmapDownloadOne")}
                  </Button>
                ) : null}
```

Le remplacer par :

```tsx
                {bundleRunId ? (
                  <>
                    <Button
                      render={
                        <a
                          href={`/api/bundles/runs/${bundleRunId}/download/${document.pdfFormId}?inline=1`}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                      nativeButton={false}
                      size="sm"
                      variant="outline"
                    >
                      <Eye data-icon="inline-start" aria-hidden />
                      {t("roadmapPreview")}
                    </Button>
                    <Button
                      render={
                        <a
                          href={`/api/bundles/runs/${bundleRunId}/download/${document.pdfFormId}`}
                        />
                      }
                      nativeButton={false}
                      size="sm"
                    >
                      <Download data-icon="inline-start" aria-hidden />
                      {t("roadmapDownloadOne")}
                    </Button>
                  </>
                ) : null}
```

(Le bouton « Revoir » juste après, avec `roadmapReview`, reste inchangé.)

- [ ] **Step 3: Ajouter la clé i18n `roadmapPreview` dans les 12 locales**

Ancre : la clé `"roadmapReview"` (présente dans les 12 locales couvertes —
contrairement à `roadmapDownloadOne`, absente hors `fr.json`). Insérer
`"roadmapPreview"` juste AVANT chaque occurrence, même indentation, même fin
de ligne (CRLF pour `fr.json`, LF pour les autres — préserver celle du
fichier). Valeurs :

| Locale | Valeur |
|---|---|
| fr | `Aperçu` |
| nl | `Voorbeeld` |
| de | `Vorschau` |
| en | `Preview` |
| es | `Vista previa` |
| it | `Anteprima` |
| pt | `Pré-visualização` |
| ru | `Просмотр` |
| tr | `Önizleme` |
| ar | `معاينة` |
| mk | `Преглед` |
| sq | `Pamje paraprake` |

Exemple pour `fr.json` (ligne `"roadmapReview": "Revoir",` existante) :

```json
      "roadmapPreview": "Aperçu",
      "roadmapReview": "Revoir",
```

Même geste dans chacun des 11 autres fichiers listés, avec la valeur de la
table ci-dessus et le libellé `roadmapReview` déjà présent comme ancre.

- [ ] **Step 4: Vérifier i18n + compilation**

Run: `pnpm i18n:check && pnpm build`
Expected: i18n OK (les 12 fichiers modifiés restent des JSON valides, `bg`/`ro`
retombent sur le repli FR déjà en place) ; build OK.

- [ ] **Step 5: Commit**

```bash
git add components/docbel/bundle-roadmap.tsx messages/fr.json messages/nl.json messages/de.json messages/en.json messages/es.json messages/it.json messages/pt.json messages/ru.json messages/tr.json messages/ar.json messages/mk.json messages/sq.json
git commit -m "feat(pdf-forms): bouton Aperçu sur Mes documents (12 locales)"
```

---

### Task 3: Validation finale et QA

**Files:** aucun (validation seule).

**Interfaces:** consomme tout ce qui précède ; ne produit rien de nouveau.

- [ ] **Step 1: Suite complète**

Run: `pnpm test && pnpm build && pnpm lint && pnpm i18n:check`
Expected: tous les tests verts (aucun nouveau test dans ce lot, donc même
total qu'avant ce chantier), build OK, lint sans nouvelle erreur, i18n OK.

- [ ] **Step 2: QA manuelle (dev)**

Lancer le dev server (PowerShell propre — cf. mémoire projet), ouvrir un
dossier déjà complété jusqu'à l'écran « Mes documents » (`BundleRoadmap`
visible, `allRequiredDone`). Vérifier :
- le bouton **Aperçu** apparaît en premier, avant Télécharger et Revoir ;
- un clic ouvre le PDF dans un **nouvel onglet**, viewer natif du navigateur —
  pas de téléchargement forcé ;
- le bouton **Télécharger** continue de forcer un téléchargement classique
  (comportement inchangé) ;
- clair/sombre OK.

Vérifier aussi, dans les logs serveur ou une requête réseau (onglet Network) :
un aperçu (`?inline=1`) n'écrit pas de ligne d'event `documents_downloaded` ;
un téléchargement classique (sans le paramètre) en écrit une, comme avant.

- [ ] **Step 3: Commit final si des ajustements de QA ont eu lieu**

Si la QA n'a rien fait remonter, aucun commit supplémentaire n'est nécessaire
— les Tasks 1 et 2 sont déjà poussées. Sinon, corriger et committer avec un
message ciblé sur ce qui a été corrigé.

```bash
git push
```

---

## Self-review (fait à l'écriture du plan)

- **Couverture spec** : paramètre `inline` sans écriture nouvelle (T1) ;
  event conditionné (T1) ; bouton avant Télécharger, icône distincte,
  `target="_blank"` (T2) ; i18n 12 locales, `bg`/`ro` sautées comme au
  chantier 1 (T2) ; QA du non-déclenchement de l'event (T3). Portée
  respectée : pas d'aperçu avant validation, pas de récapitulatif texte, pas
  de nouvel event dédié.
- **Placeholders** : aucun TBD. L'absence de nouveaux tests unitaires est une
  décision documentée (pas de patron HTTP-test existant sur cet arbre de
  routes), pas un trou de plan.
- **Cohérence de types** : aucun nouveau type introduit — la route et le
  composant échangent une URL avec query string, rien à faire correspondre
  entre tâches au-delà du chemin `?inline=1` utilisé identiquement en T1 et T2.
