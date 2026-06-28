# Système d'onboarding — Notes d'implémentation

> Ce fichier résume tout ce qui a été construit pendant que tu dormais.
> Il peut être supprimé une fois que tu as tout intégré.

## ⚙️ Étape obligatoire avant de tester

Une migration Prisma a été créée (`prisma/migrations/12_onboarding_extensions/`).
**Tu dois l'appliquer à ta base locale** avant que l'app fonctionne :

```bash
pnpm db:migrate:dev   # crée + applique la migration
# OU si tu préfères push direct sans tracker (dev only) :
pnpm db:push
```

Le script `prisma generate` a déjà tourné — le client TypeScript connaît
déjà les nouveaux champs.

## 🆕 Variables d'environnement à vérifier

Aucune **nouvelle** variable n'est requise — l'implémentation réutilise ce qui
existait déjà :

- `RESEND_API_KEY` + `EMAIL_FROM` — pour l'envoi du code de reprise par email
- `ANTHROPIC_API_KEY` — pour l'IA d'intent-detection (optionnel : si absente,
  le fallback de matching local prend le relais)
- Toggle admin `AI_HELP_ENABLED = "true"` dans la table `AppSetting` — active
  l'IA pour l'intent-detection (la même clé qui active déjà l'aide IA sur les
  champs de formulaire)

## 🗂 Ce qui a été ajouté

### Côté données

- **Migration 12** (`prisma/migrations/12_onboarding_extensions/migration.sql`) :
  - `DocumentBundle.lifeEventCategory` — catégorie d'événement de vie
  - `DocumentBundle.showOnOnboarding` — flag de mise en avant
  - `DocumentBundle.vocabularyTags` — tags / synonymes (JSON `string[]`)
  - `DocumentBundle.eligibilityQuestions` — questions de pré-qualif (JSON)
  - `DocumentBundle.warnings` — avertissements importants (JSON)
  - `BundleRun.resumeCode` — code lisible utilisateur (`BELDOC-XXXX-XXXX`)
  - `BundleRun.resumeCodeExpiresAt` — TTL par défaut 30 jours
  - `BundleRun.resumeEmail` — email optionnel pour rappel
  - `BundleRun.eligibilityAnswers` — réponses au questionnaire pré-qualif

### Moteur de conditions étendu (AND/OR récursif)

[`lib/documents/bundle-conditions.ts`](lib/documents/bundle-conditions.ts) — **réécrit avec rétro-compat totale** :

- Lit le format **V1 legacy** (`Rule[]` ANDé implicite) — aucun bundle existant cassé
- Écrit en **V2** (`{ type: "and" | "or", rules: ConditionNode[] }`, récursif)
- Nouveaux opérateurs : `gt`, `lt`, `gte`, `lte`, `notIn`, `isEmpty`, `isNotEmpty`
- Tests : [`lib/documents/__tests__/bundle-conditions.test.ts`](lib/documents/__tests__/bundle-conditions.test.ts) — 25+ cas, validant notamment le cas réel chômage temporaire : `première_demande OR (même_employeur AND changement_horaire)`

### Utilitaires (nouveau dossier `lib/bundles/`)

- [`lib/bundles/resume-code.ts`](lib/bundles/resume-code.ts) — génération/validation des codes (alphabet sans caractères ambigus 0/O/1/I/L)
- [`lib/bundles/eligibility.ts`](lib/bundles/eligibility.ts) — types + évaluateur de pré-qualif
- [`lib/bundles/vocabulary.ts`](lib/bundles/vocabulary.ts) — matching texte ↔ bundles avec tokenisation + stopwords
- [`lib/bundles/types.ts`](lib/bundles/types.ts) — `LIFE_EVENT_CATEGORIES` (8 catégories : emploi, formation, famille, logement, santé, pension, social, indépendant), types `BundleWarning`

### APIs

| Méthode | Endpoint | Rôle |
|---|---|---|
| GET/PUT | `/api/documents/bundles/[id]` | Étendu pour accepter les nouveaux champs |
| POST | `/api/documents/bundles` | Idem |
| POST | `/api/documents/bundles/[id]/run` | Génère un `resumeCode` unique au démarrage, accepte `eligibilityAnswers` |
| PATCH | `/api/documents/bundles/[id]/run` | **Nouveau** — met à jour les réponses pré-qualif après création |
| POST | `/api/bundles/resume` | **Nouveau** — valide un code, configure le cookie, retourne le bundle slug |
| POST | `/api/bundles/runs/[runId]/email-code` | **Nouveau** — envoie le code par email via Resend (rate-limit 5/15min/IP) |
| POST | `/api/intent-detect` | **Nouveau** — matching libre → bundle (Claude Haiku 4.5 + fallback local) |

### Pages publiques

- **`/onboarding`** — page d'accueil "Quelle est ma situation ?"
  - Hero + recherche libre (lance `/api/intent-detect`)
  - Grille des bundles flagués `showOnOnboarding` regroupés par `lifeEventCategory`
  - Bloc "Reprendre un dossier" → `/reprendre`
  - Mention RGPD "code non sauvegardé = données perdues"
- **`/reprendre`** — saisie du code de reprise + démarrage d'un nouveau dossier

### Composants citoyens

- [`components/docbel/onboarding/eligibility-prequalifier.tsx`](components/docbel/onboarding/eligibility-prequalifier.tsx) — questionnaire pré-démarrage avec verdict visuel 🟢🟠🔴, **bouton "Continuer quand même" toujours actif** même en verdict défavorable
- [`components/docbel/onboarding/bundle-warnings.tsx`](components/docbel/onboarding/bundle-warnings.tsx) — alertes en tête de parcours, 3 niveaux (info/warning/critical)
- [`components/docbel/onboarding/resume-code-banner.tsx`](components/docbel/onboarding/resume-code-banner.tsx) — bandeau code de reprise avec copy + envoi email + avertissement "perdu si non sauvegardé"
- [`components/docbel/onboarding/intent-search.tsx`](components/docbel/onboarding/intent-search.tsx) — barre de recherche avec affichage des suggestions IA
- [`components/docbel/onboarding/life-event-card.tsx`](components/docbel/onboarding/life-event-card.tsx) — carte d'événement de vie sur la grille onboarding
- [`components/docbel/onboarding/resume-form.tsx`](components/docbel/onboarding/resume-form.tsx) — formulaire de saisie du code de reprise

### Composants admin

- [`components/admin/documents/bundle-condition-editor.tsx`](components/admin/documents/bundle-condition-editor.tsx) — **réécrit** :
  - Sélecteur ET/OU au-dessus de 2+ règles
  - Tous les nouveaux opérateurs disponibles
  - Fallback éditeur JSON brut pour les arbres imbriqués (>1 niveau de groupes)
- [`components/admin/documents/eligibility-questions-editor.tsx`](components/admin/documents/eligibility-questions-editor.tsx) — édition des questions oui/non + multi-choix, avec verdict par réponse
- [`components/admin/documents/bundle-warnings-editor.tsx`](components/admin/documents/bundle-warnings-editor.tsx) — édition des warnings (sévérité + titre + message + URL)
- [`components/admin/documents/vocabulary-tags-editor.tsx`](components/admin/documents/vocabulary-tags-editor.tsx) — input à chips
- [`components/admin/documents/bundles-admin.tsx`](components/admin/documents/bundles-admin.tsx) — étendu avec 3 nouvelles sections dans la dialog de création/édition

### BundleRunner (parcours public)

[`components/docbel/bundle-runner.tsx`](components/docbel/bundle-runner.tsx) — réécrit :
- **Affiche les warnings** en tête
- **Affiche la pré-qualif** si le bundle en a, avant de démarrer le run
- **Affiche la bannière code de reprise** une fois le run créé
- Permet de modifier les réponses pré-qualif après coup (bouton "Modifier mes réponses préliminaires")

## ❗ Ce qui N'A PAS été fait (volontairement)

1. **Contenu des 3 dossiers** (chômage temporaire, chômage complet, ACTIVA Brussels) — tu maîtrises le domaine, je serais inexact. **À faire dans l'admin une fois la migration appliquée.**
2. **Éditeur visuel flowchart drag & drop** (React Flow) — la décision a été prise d'étendre l'existant plutôt que de construire un système concurrent. L'éditeur de conditions actuel couvre les groupes plats AND/OR ; pour des arbres imbriqués un fallback JSON est disponible. Un vrai éditeur visuel React Flow demanderait ~1500 lignes — à faire en session dédiée si le besoin se confirme.
3. **Tests E2E des nouvelles pages** — les tests unitaires couvrent la lib de conditions, mais pas les UI pages. À ajouter si tu utilises Playwright/Vitest browser plus tard.
4. **Lien depuis la page d'accueil vers `/onboarding`** — je n'ai pas modifié le hero existant. Tu décideras où mettre le CTA principal.
5. **Mode "agent / partenaire"** — pas implémenté (tu as dit "plus tard").

## 🧪 Comment tester demain

### 1. Appliquer la migration
```bash
pnpm db:migrate:dev
```

### 2. Lancer le dev
```bash
pnpm dev
```

### 3. Tester le flux admin
- Va dans `/admin/documents/bundles`
- Crée un nouveau bundle (ou édite un existant)
- Tu verras maintenant 3 nouvelles sections dans la dialog :
  - **Onboarding** : catégorie + checkbox "afficher sur onboarding" + tags vocabulaire
  - **Pré-qualification** : questions avec verdicts
  - **Avertissements** : alertes affichées au citoyen
- Sur les items du bundle, l'éditeur de conditions montre maintenant un toggle ET/OU

### 4. Tester le flux citoyen
- Va sur `/onboarding`
- Tape une requête libre (essaie "j'ai perdu mon emploi" si l'AI est activée)
- Clique sur un bundle → tu vois warnings + pré-qualif → "Démarrer" → bandeau de code de reprise
- Copie le code, va sur `/reprendre`, colle-le → tu reviens dans le dossier

### 5. Tester l'IA (optionnel)
- Active `AI_HELP_ENABLED = "true"` dans `/admin/documents/settings` (ou directement en BDD)
- Assure-toi que `ANTHROPIC_API_KEY` est dans `.env.local`
- Sur `/onboarding`, tape une phrase libre → tu devrais voir un message "L'assistant suggère :"

### 6. Tester l'email
- Démarre un dossier → clique "Recevoir par email" dans la bannière
- Vérifie que ton `RESEND_API_KEY` est configurée

## 📐 Architecture du modèle de conditions

Le format **V2** est récursif :

```typescript
type ConditionNode = ConditionLeaf | ConditionGroup;

type ConditionLeaf = {
  type: "leaf";
  sourceTemplateId: string;
  fieldId: string;
  op: "equals" | "notEquals" | "in" | "notIn" | "contains"
    | "truthy" | "falsy" | "gt" | "lt" | "gte" | "lte"
    | "isEmpty" | "isNotEmpty";
  value?: string | number | boolean | (string | number | boolean)[];
};

type ConditionGroup = {
  type: "and" | "or";
  rules: ConditionNode[];
};
```

Exemple chômage temporaire :

```json
{
  "type": "or",
  "rules": [
    { "type": "leaf", "sourceTemplateId": "tplPrequal", "fieldId": "premiereDemande", "op": "equals", "value": "yes" },
    {
      "type": "and",
      "rules": [
        { "type": "leaf", "sourceTemplateId": "tplPrequal", "fieldId": "memeEmployeur", "op": "truthy" },
        { "type": "leaf", "sourceTemplateId": "tplPrequal", "fieldId": "changementHoraire", "op": "equals", "value": "yes" }
      ]
    }
  ]
}
```

## 🔒 Considérations sécurité

- **Code de reprise** : pas un secret cryptographique. Il ouvre l'accès à un dossier anonyme (aucune PII liée). TTL 30 jours + rate-limit 10 tentatives / 5 min / IP pour limiter le brute-force.
- **Endpoints non-authentifiés** : `/api/bundles/resume` et `/api/bundles/runs/[runId]/email-code` sont volontairement publics car il n'y a pas de comptes. La preuve d'accès = connaissance du code (ou du `runId` interne pour l'email).
- **AI** : appels Claude rate-limités, prompt strict (refuse PII, ne décide pas, cite le catalogue uniquement).
- **RGPD** : aucune donnée personnelle ajoutée par cette implémentation. L'email pour rappel est optionnel et stocké sur le `BundleRun` (purgé avec le run à expiration).

## 🐛 Limitations connues

- L'éditeur de conditions en mode visuel ne gère que les **groupes plats** (un seul niveau de AND ou OR). Pour des arbres mixtes, fallback éditeur JSON brut.
- Le matching local de vocabulaire est simple (tokens + stopwords FR). Pour du multi-langue, ajouter des stopwords NL/EN dans `lib/bundles/vocabulary.ts`.
- Pas de pagination sur `/onboarding` : si tu publies 50+ bundles featured, ça va devenir long. À voir si pertinent.
- Le `resumeCode` ne dépend pas de l'IP de création — il marche d'où on veut. C'est volontaire (changement d'appareil) mais ça veut dire qu'un code partagé entre proches fonctionne aussi. Pas un problème vu la nature non-sensible des données en cours de saisie.

---

Tout est typé, testé (73 tests passent), construit sans erreur (`pnpm build` OK).

Si quelque chose te semble étrange, c'est probablement intentionnel et lié à une
contrainte qu'on a discutée — sinon, fais-moi signe au matin.
