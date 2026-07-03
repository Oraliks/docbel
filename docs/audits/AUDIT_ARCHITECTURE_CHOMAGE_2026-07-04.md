# Audit d'architecture — Écosystème Docbel Chômage

**Date** : 2026-07-04 · **Méthode** : 4 explorations parallèles du code (moteur dossiers, pipeline PDF, barèmes/calculateurs, orientation/admin/versioning) · **Statut** : recommandations, rien n'est implémenté.

---

## Résumé exécutif

1. **Ton système est beaucoup plus avancé que ta question ne le suppose.** L'essentiel de ce que tu demandes existe déjà : moteur de dossiers hybride code/DB, PDF versionnés avec diff de migration, arbres d'orientation versionnés (Decision Builder), pipeline d'import de barèmes avec workflow 4 yeux, conditions partagées, RGPD natif (zéro stockage des PDF générés).
2. **Le vrai problème n'est pas l'absence de système, c'est la non-connexion de deux mondes** : les barèmes importés en DB (consultation) et les barèmes codés en dur dans les calculateurs (calcul) **ne se parlent jamais**. C'est exactement le scénario que tu redoutes : tu peux publier un nouveau barème dans l'admin sans que le simulateur de la home ne change d'un centime.
3. **Deuxième fracture : les règles d'éligibilité existent en 5 exemplaires** (arbre d'orientation, questions des dossiers, wizard config.ts, narratif i18n, docs/knowledge en Markdown non exécutable). La réforme 2026 est un patchwork de commentaires de code.
4. **Le corpus RioLex (443 articles) est un silo** : relié à l'IA par RAG, mais aucune règle, aucun barème, aucun dossier ne pointe structurellement vers son article source.
5. **La bonne stratégie n'est PAS une refonte ni un moteur de règles générique en DB.** C'est une consolidation : créer un **paquet domaine `lib/chomage/`** (paramètres datés, catégories canoniques, règles pures sourcées) que tout le reste consomme, plus un **test de parité** entre le code et le barème publié en DB.

---

## Mission A — Audit du parcours de création de dossier

### Ce qui marche

- **Écran d'explication (journey)** : le nouvel écran 4 étapes + CTA (live sur allocations-insertion) répond exactement au besoin « l'utilisateur comprend ce qu'il fait avant de commencer ».
- **Pré-qualification informative, jamais bloquante** : conforme à ton principe UX. Verdict toujours neutre, warnings à sévérité (`info`/`warning`/`critical`).
- **Documents avec responsabilité** (`user` / `employer` / `onem` / `external`) + courrier de réclamation généré pour les documents à charge d'un tiers : très bon pattern, rare.
- **Reprise** : cookie 30 j + code lisible `BELDOC-XXXX-YYYY` (HMAC, jamais en clair) + email. Solide.
- **Validation pédagogique** : messages NISS qui distinguent « mauvais nombre de chiffres » vs « faute de frappe », multilingues FR/NL/DE.
- **Triggers** : un PDF peut en déclencher un autre (C1 → C1C si « Tremplin indépendants ») — la mécanique « poser uniquement les questions nécessaires » existe déjà au niveau des PDF.

### Ce qui est fragile

| Problème | Détail | Gravité |
|---|---|---|
| **Entrées multiples non hiérarchisées** | `/mon-dossier` (wizard 3 col), `/creer-ma-demande` (grille par événement de vie), `/d/[slug]` (direct). Trois portes, pas de funnel canonique clair. | Moyen |
| **Questions posées deux fois** | Le wizard d'orientation collecte des réponses (`orientationAnswers`), puis la pré-qualification du dossier repose des questions proches, puis chaque PDF redemande des champs. `BundleRun.payloads` partage entre PDF d'un même bundle, mais orientation → pré-qualif → PDF ne forment pas une chaîne de données continue. | **Haut** |
| **Pas de checklist finale consolidée** | Chaque PDF se télécharge individuellement. Il manque l'écran de sortie : « Voici vos 3 PDF. ① Imprimez. ② Signez ici et ici. ③ Joignez votre C4. ④ Envoyez à la CAPAC avant le X. » | **Haut** |
| **Le « pourquoi » n'est pas systématique** | `helpText` existe par question, mais pas d'affordance systématique « pourquoi cette question ? » (base légale, conséquence). | Moyen |
| **Orientation dupliquée** | Le Decision Builder est prêt mais le flag `DECISION_TREE_RUNTIME_ENABLED` est OFF : `config.ts` reste la source réelle. Deux arbres à maintenir tant que le flag n'est pas activé. | Moyen |
| **Arrays tronqués en silence** | 10 cohabitants saisis, 5 lignes dans le PDF → perte silencieuse. | Moyen |

### Réponses directes à tes questions A

- *Peut-on détecter plus tôt le bon type de dossier ?* Oui : activer le runtime Decision Builder et **injecter les `orientationAnswers` dans la pré-qualification** pour pré-répondre (statut, âge, situation) au lieu de re-demander.
- *Le système évite-t-il les erreurs de dossier ?* Partiellement : la matrice `whoConcerned` filtre par statut, mais rien ne détecte « vous êtes dans le mauvais dossier » en cours de route (ex. l'utilisateur en chômage temporaire qui répond comme un chômeur complet).
- *Le résultat final est-il rassurant ?* Non, c'est le maillon faible : la fin de parcours est une liste de téléchargements, pas une feuille de route.

---

## Mission B — Cartographie des flux actuels

```
                    UTILISATEUR
        ┌───────────┼──────────────┐
   Simulateurs   Consultation   Parcours dossiers
   (home, AGR,    barèmes        (wizard → /d/[slug]
    calculateur)  (/outils/…)     → PDF préremplis)
        │             │               │
        ▼             ▼               ▼
  ① CODE TS      ② DB PRISMA     ①+② mélangés
  constantes     BaremeFile/     DossierDefinition (TS)
  en dur         BaremeAmount    + DocumentBundle (DB)
  (chomage.ts,   (import ONEM,   + PdfForm (DB, versionné)
   agr, brut-net) 4 yeux, daté)
        ╳ ←──── AUCUN LIEN ────→ ╳
```

**Trois mondes de données, zéro pont** :
1. **Code TS** : plafonds/forfaits/taux (`lib/calculators/chomage.ts`, `BAREME_VERSION = "2026-03-01"` en commentaire), paramètres AGR (`lib/agr/baremes.ts`), règles narratives des dossiers. Rafraîchi par redéploiement.
2. **DB Prisma** : barèmes importés de l'Excel ONEM (traçables ligne par ligne, workflow draft → 4 yeux → published, `validFrom`), lus uniquement par les pages de consultation et `/api/baremes/lookup`.
3. **i18n / docs** : le narratif de la réforme 2026 (156 jours, 12 mois, 25 ans) vit dans `messages/*.json` et `docs/knowledge/chomage/` (51 règles Markdown non exécutables).

Constat annexe : **les montants des allocations d'insertion n'existent nulle part en code** — seulement en narratif. Le dossier live ne peut rien chiffrer.

---

## Mission C — Sources uniques de vérité

### Table cible

| Donnée | Aujourd'hui | Source unique cible | Consommateurs |
|---|---|---|---|
| **Barèmes chômage** (plafonds, forfaits, taux) | 2 exemplaires déconnectés (TS + DB) | `lib/chomage/params.ts` : jeux de paramètres **datés** (`validFrom`/`validTo` + source), **vérifiés par test de parité** contre le BaremeFile publié | Simulateur home, calculateur complet, dossiers, explications, pages partenaires |
| **Catégories familiales** | Type `SituationFamiliale` répété (calculators, dossiers, AGR, narratif) | `lib/chomage/categories.ts` — un seul type + libellés i18n keyed | Tout |
| **Phases de dégressivité** | `chomage.ts` uniquement | Idem `lib/chomage/` | Calculateur, explications, timeline |
| **Règles d'éligibilité** | 5 endroits | `lib/chomage/eligibility/` : fonctions pures → verdict structuré `{status, reasons[], sources[]}` | Dossiers (pré-qualif), arbre d'orientation (affichage), simulateurs, IA |
| **Formulaires PDF** | ✅ `PdfForm` versionné — déjà bon | Inchangé | Bundles, admin |
| **Documents justificatifs** | Par dossier en TS, dupliqués entre dossiers | Catalogue central (`lib/chomage/documents.ts` ou table) référencé par slug | Dossiers, checklist finale, explications |
| **Textes pédagogiques** | Éparpillés (bundle.description, Tool.description, News, page-builder) | Blocs d'explication réutilisables keyed (voir Mission H) | Parcours, simulateurs, résultats |
| **Sources légales** | RioLex silo (RAG IA uniquement) | `sourceRef` (riolexId/URL) porté par chaque paramètre et règle | Badge « source » partout, espace partenaire |
| **Orientation** | `config.ts` + DecisionTree en double | DecisionTree publié (flag ON), `config.ts` supprimé après parité | /mon-dossier |

### Risques si tu dupliques (ce qui arrive déjà)

- Divergence silencieuse calcul ↔ consultation : l'utilisateur lit un montant sur `/outils/bareme-chomage` et en calcule un autre sur la home.
- Réforme appliquée partiellement : la réforme 2026 a demandé de toucher `chomage.ts`, `allocations-insertion/index.ts`, `config.ts`, `messages/*.json` et docs — sans checklist automatique, un oubli est invisible.
- Le savoir vit dans ta tête : `BAREME_VERSION` en commentaire n'est ni requêtable ni testable.

### Le mécanisme de propagation (exemple demandé : « le barème X change »)

1. Import du nouvel Excel ONEM dans l'admin → workflow 4 yeux → **published** (existe déjà).
2. **Test de parité** (nouveau) : un test vitest compare `getParams(date)` (code) aux `BaremeAmount` publiés (fixture exportée). Le test **échoue** → tu sais exactement quelles constantes mettre à jour.
3. Tu ajoutes un **nouveau jeu de paramètres daté** dans `params.ts` (l'ancien reste, avec `validTo`). Une PR, un diff lisible, des tests des deux côtés de la date pivot.
4. Tous les consommateurs (simulateur, wizard, explications, warnings, pages partenaires) appellent `getParams(date)` → propagation automatique.
5. Moyen terme : script de **code-gen** `params.generated.ts` depuis le BaremeFile publié — la DB devient la source opérationnelle, le code garde typage + review git.

Pourquoi ne pas faire lire la DB directement par les calculateurs ? Parce qu'un calcul légal doit être **typé, testé, reviewé et reproductible** ; une lecture DB à chaud introduit cache, latence, indisponibilité et surtout la possibilité qu'un import erroné change les résultats sans passer par un test. Le test de parité + code-gen te donne la synchronisation **avec** le filet de sécurité.

---

## Mission D — Architecture modulaire cible

Règle de dépendance : **tout dépend de `chomage-domain`, `chomage-domain` ne dépend de rien** (pur, sans Prisma, sans React, sans next-intl). Une règle ESLint d'import peut l'imposer.

| Module | Existe ? | Rôle | Ne doit PAS contenir | Communique avec |
|---|---|---|---|---|
| **chomage-domain** (`lib/chomage/`) | ❌ à créer | Paramètres datés, catégories, phases, règles d'éligibilité pures, verdicts structurés, refs sources | UI, DB, i18n (seulement des clés) | Consommé par tous |
| **dossiers** (`lib/dossiers/`) | ✅ | `DossierDefinition`, registry, journey, sérialiseurs | Montants, règles de calcul (→ domain) | domain, pdf-forms, bundles |
| **orientation** (`lib/decision-builder/`) | ✅ | Arbres versionnés, moteur pur, éditeur admin | Règles d'éligibilité en dur dans les nœuds (pointer les règles domain) | domain, dossiers (bundleSlug) |
| **pdf-forms** (`lib/pdf-forms/`) | ✅ excellent | Parsing AcroForm, schéma dual, remplissage, validation, révisions | Logique métier chômage | dossiers (via DocumentBundleItem) |
| **baremes-import** (`lib/baremes/`) | ✅ | Import Excel officiel, traçabilité, 4 yeux, publication | Calculs | Alimente/valide domain (parité, code-gen) |
| **documents-justificatifs** | ❌ à créer | Catalogue central (slug, émetteur, comment l'obtenir, délais) | Conditions d'inclusion (restent dans les dossiers) | dossiers, checklist, explications |
| **explications** | ⚠️ éparpillé | Blocs pédagogiques réutilisables keyed, traduits via ContentTranslation | Logique | Tout le front |
| **reglementation** (`lib/reglementation/` + KnowledgeSource) | ✅ | Corpus RioLex, recherche hybride | — | Fournit les `sourceRef` au domain ; IA |
| **simulateurs** (`lib/calculators/`, `lib/agr/`, `lib/ec32/`) | ✅ | Adaptateurs UI sur le domain | Barèmes en dur (à extraire) | domain |
| **ia** (`lib/chomage-ia/`) | ✅ | RAG sur corpus + (cible) verdicts du domain | Inventer des règles | domain, reglementation |
| **stats** | ⚠️ partiel | Événements anonymisés (`/api/bundles/events` existe) | PII | dossiers |

---

## Mission E — Familles de dossiers

Colonnes : état actuel, questions clés, documents, PDF, règles domain utilisées, escalade humaine. **⚠️ À valider par toi (expertise domaine) — je liste la structure, pas la vérité ONEM.**

| Famille | État | Questions essentielles | PDF / documents | Règles & barèmes | Escalade conseiller |
|---|---|---|---|---|---|
| Chômage complet | ✅ squelette (`chomage-complet`) | Motif fin de contrat, date, inscription service régional, situation familiale | C1 (+C4 employeur, C109) | Admissibilité (jours travaillés), dégressivité, catégories | Démission, licenciement pour faute |
| Chômage temporaire | ✅ mature (11 motifs, natures DA) | Statut, motif, premier ?, transfert | C1, C3.2, C32 | Motifs × statut (`whoConcerned`) | Litige employeur |
| Allocations d'insertion | ✅ live (journey) | Âge, études, stage 156 j, nationalité | C1, attestations études | **Montants absents du code !** Durée 12 mois (réforme) | > 25 ans, exceptions |
| AGR / temps partiel maintien des droits | ⚠️ moteur AGR partenaire seulement | Heures, salaire, catégorie A/N/B | C131A/B, formulaire AGR | `lib/agr/` (isolé) | Calcul contesté |
| Frontalier | ✅ squelette | Pays d'emploi, résidence | C1, U1/PD U1, C32 | Règles EEE | Presque toujours |
| RCC (prépension) | ✅ squelette | Âge, ancienneté, CCT | C1, C4ASR | Conditions d'âge CCT | Souvent |
| Fin de droit / exclusion | ❌ | Notification reçue, dates | — (orientation) | Réforme 2026 (fin de droit 24 mois) | **Toujours** + CPAS |
| Démission | ❌ (sous-cas de complet) | Motif légitime ? | C1 + warning sanction | Liste motifs légitimes | Souvent |
| Reprise de travail / changement de situation | ❌ | Type de changement | C131, C1 modificatif | Obligation de déclaration | Rarement |
| Changement familial | ❌ | Nouvelle composition | C1 modificatif | Catégories familiales | Rarement |
| Orientation CPAS | ❌ | Ressources, exclusion | — | Seuils RIS | **Toujours** |
| Contestation / sanction | ❌ | Type de décision, délais de recours | — | Délais de recours | **Toujours** (tribunal du travail) |

Priorité : compléter **chômage complet** (le volume) et **encoder les montants d'insertion** avant de créer de nouvelles familles. Les familles « escalade toujours » (fin de droit, contestation, CPAS) doivent exister comme **parcours d'orientation courts**, pas comme wizards complets.

---

## Mission F — UX du parcours cible

**Funnel canonique unique** :

```
/chomage (hub) → Orientation (arbre, 3-5 questions max)
  → Fiche dossier (= journey intro : étapes, documents, durée, avertissements)
    → Wizard (questions mutualisées, sections courtes, mobile-first)
      → Écran de sortie (feuille de route)
```

1. **Orientation** : arbre Decision Builder (flag ON). Chaque réponse est **conservée** et pré-remplit la suite. Bouton « je ne sais pas » à chaque étape → oriente vers un conseiller sans culpabiliser.
2. **Fiche dossier = ton journey actuel, généralisé** aux 5 dossiers : c'est le bon écran, il donne le contrôle avant l'engagement.
3. **Wizard** : progression par sections (« Identité — 2 min », « Votre situation — 3 min »), une question par écran sur mobile, chaque question avec « Pourquoi ? » dépliable (règle domain + source). Sauvegarde continue (déjà en place).
4. **Écran de sortie — le chaînon manquant, priorité UX n°1** :
   - les PDF générés, chacun avec « à imprimer / à signer (où) / à faire compléter par (qui) » ;
   - la checklist des pièces à joindre (catalogue justificatifs) ;
   - le destinataire (son OP : syndicat/CAPAC — demandé pendant le parcours) + délai ;
   - le code de reprise + envoi par email ;
   - l'encart « ce que Docbel ne fait pas » : pas de décision, montants indicatifs, l'OP tranche.
5. **Incertitude** : quand le verdict domain est `refer`, l'UI affiche le bloc « à vérifier avec votre organisme » avec le *pourquoi* — jamais un mur.

---

## Mission G — Génération PDF

Verdict : **c'est ton module le plus abouti — n'y touche presque pas.** Schéma dual (ancre AcroForm immuable + enrichissement éditable), révisions avec diff et migration semi-automatique de l'enrichissement, presets de validation, prefill (system/profile/itsme), triggers, zéro stockage du PDF généré, logs sans PII.

À faire, par priorité :
1. **Instructions post-génération par PDF** : ajouter au `PdfForm` des champs éditables admin `instructions: {print, sign, attach, sendTo}` affichés sur l'écran de sortie.
2. **Garde-fou parité règle/PDF** : quand une règle domain référencée par un dossier change de version, marquer les bundles concernés « à re-vérifier » dans l'admin (simple requête sur les refs, pas de moteur).
3. **maxRows des arrays** : alerte UX au lieu de troncature silencieuse.
4. Doccle / itsme : stubs propres, à finaliser quand les credentials arrivent — pas un chantier d'architecture.
5. La convention pipe-radio (`w1|w2|w3`) : la documenter dans l'admin (risque d'inversion oui/non).

---

## Mission H — Admin : éditable vs code

**Règle de partage** : *les données changent en admin, la logique change en code.* Tu es seul dev — chaque éditeur admin est un mini-langage à construire, tester et sécuriser. Tu en as déjà trois bons (arbres, PDF, barèmes) ; n'en crée pas un quatrième pour la logique de calcul.

| Éditable en admin | Statut | Reste en code | Pourquoi |
|---|---|---|---|
| Barèmes (import, 4 yeux, publication) | ✅ existe | Formules de calcul | Typé, testé, reviewé |
| Arbres d'orientation | ✅ existe | Moteur de conditions | Idem |
| PDF (schéma, validations, mappings, révisions) | ✅ existe | Parsing/remplissage | Idem |
| Textes pédagogiques + traductions | ✅ ContentTranslation | Structure des dossiers (`DossierDefinition`) | Le seed idempotent + git = déjà un bon versioning |
| Catalogue documents justificatifs | ❌ candidat (table simple) | Conditions d'inclusion (`includeWhen`) | Les conditions sont de la logique |
| Instructions post-génération PDF | ❌ candidat | Règles d'éligibilité | Verdicts = logique sensible |
| Warnings (texte, sévérité) | ⚠️ partiel (JSON bundle) | Leurs conditions de déclenchement | Idem |
| Statut actif/inactif, dates d'entrée en vigueur | ⚠️ partiel | — | — |

---

## Mission I — Versioning & législation

Le pattern unique à généraliser : **jeu de paramètres daté + résolveur par date**.

```ts
interface VersionedParams<T> {
  validFrom: string;          // "2026-03-01"
  validTo?: string;           // undefined = en vigueur
  source: SourceRef;          // AR/article RioLex + URL ONEM
  label: string;              // "Réforme chômage mars 2026"
  values: T;
}
function resolveParams<T>(sets: VersionedParams<T>[], date: Date): VersionedParams<T>
```

- **Anciens dossiers** : `BundleRun` stocke déjà les payloads ; ajouter `paramsVersion` (la date résolue) au moment de la génération → un ancien dossier reste explicable.
- **Anticiper une réforme** : ajouter le jeu futur avec `validFrom` dans le futur ; les tests couvrent les deux côtés de la pivot ; le front peut afficher « à partir du 01/03, ce montant devient X ».
- **Affichage** : badge « Montants au JJ/MM/AAAA — source ONEM » partout où un chiffre apparaît (composant unique).
- Déjà en place et à conserver tel quel : `DecisionTreeRevision` (versions numérotées + diff), `PdfFormRevision`, `BaremeFile.validFrom` + `BaremePublicationLog`.
- Manquant : versioning des constantes de calcul (→ le pattern ci-dessus), `publishedAt` sur `Page`.

---

## Mission J — Confidentialité & RGPD

Acquis solides (à ne pas casser) : PDF générés jamais stockés (streaming one-shot) ; `PdfFormSubmissionLog` sans PII (payloadHash, ipHash) ; codes de reprise hashés HMAC ; `BundleRun.anonymizedAt` + cron de purge ; consentement obligatoire avant génération ; rate-limit sur la génération.

Points de vigilance :
1. **`PdfFormDraft.payload` et `BundleRun.payloads` contiennent des PII en clair** (NISS, adresse, revenus) pendant leur durée de vie. C'est acceptable si : cron de purge **effectivement schedulé et monitoré** (à vérifier), TTL courts, et chiffrement at-rest côté Neon.
2. **`UserProfile` sans cascade** : suppression du compte ≠ suppression du profil. À corriger.
3. **Stats anonymisées** : `/api/bundles/events` existe ; règle à formaliser — jamais de payload dans un événement, uniquement slug/étape/timestamp arrondi.
4. **Transparence** : l'écran de sortie doit dire en une phrase ce qui est conservé (« vos réponses sont gardées 30 jours pour la reprise, puis supprimées ; le PDF n'est jamais stocké »).
5. NRN : ne jamais logger ; il n'apparaît que dans payloads temporaires et le PDF streamé — garder cette discipline sur tout nouveau module.

---

## Mission K — Trois trajectoires

### Option 1 — Consolidation du socle (recommandée MAINTENANT)
- **Principe** : ne rien refondre ; créer `lib/chomage/` et y aspirer les constantes ; test de parité DB↔code ; catégories canoniques ; montants insertion encodés ; écran de sortie.
- **Avantages** : élimine le risque n°1 (divergence barèmes) en ~2 semaines ; zéro migration DB ou presque ; chaque lot = 3-5 fichiers.
- **Inconvénients** : l'admin ne peut toujours pas modifier une formule (c'est voulu).
- **Complexité** : faible. **Durée réaliste** : 2-3 semaines en lots.
- **Erreur à éviter** : en profiter pour « nettoyer » les calculateurs — extraction pure, comportement identique, tests verts.

### Option 2 — Système modulaire connecté (trajectoire 2-3 mois)
- **Principe** : Option 1 + code-gen des params depuis le BaremeFile publié ; règles d'éligibilité pures avec verdicts sourcés consommées par dossiers/arbre/simulateurs ; catalogue documents justificatifs (admin) ; blocs d'explication réutilisables ; runtime Decision Builder ON et `config.ts` supprimé ; chaînage orientation → pré-qualif (fin des questions doublées) ; badge source/version généralisé.
- **Avantages** : ta vision « un changement, un endroit » devient réelle et vérifiable par CI.
- **Inconvénients** : discipline d'import (lint) à instaurer ; migration douce des simulateurs.
- **Complexité** : moyenne. **Durée** : 2-3 mois en incréments shippables.
- **Erreur à éviter** : vouloir migrer tous les calculateurs d'un coup — un par lot, parité testée.

### Option 3 — Plateforme complète (6-12 mois, seulement si traction)
- **Principe** : édition admin des paramètres avec workflow 4 yeux (réutiliser celui des barèmes) ; simulateur de scénarios dans l'admin (« teste ce parcours avec ce profil ») ; IA publique ancrée sur verdicts domain + corpus (jamais génératrice de règles) ; dashboard rétention RGPD ; stats anonymisées complètes ; API partenaires.
- **Avantages** : produit défendable, quasi-régie administrative.
- **Inconvénients** : charge de maintenance d'un back-office riche pour un solo dev ; à ne lancer que si partenaires/revenus le justifient.
- **Erreur à éviter** : le moteur de règles générique en DB (DSL maison). Le Decision Builder est déjà ton DSL — un seul suffit.

---

## Mission L — Structures de données

```ts
// lib/chomage/categories.ts — LA définition, réexportée partout
export type SituationFamiliale = "chef_menage" | "isole" | "cohabitant";
export type ChomagePhase = "1A" | "1B" | "2A" | "2B" | "2C" | "3";

// lib/chomage/sources.ts
export interface SourceRef {
  label: string;              // "AR 25.11.1991, art. 63"
  riolexId?: string;          // lien corpus RioLex
  url?: string;               // page ONEM officielle
  verifiedAt: string;         // "2026-07-04"
}

// lib/chomage/params.ts — jeux de paramètres datés
export interface ChomageParams {
  plafonds: Record<"1A" | "1B" | "2" , number>;
  taux: Record<"1A" | "autres", number>;
  forfaits: Record<"min" | "max" | "2C" | "3", Record<SituationFamiliale, number>>;
  insertion: { montants: Record<SituationFamiliale, number>; dureeMois: number; stageJours: number; ageMax: number };
}
export const PARAM_SETS: VersionedParams<ChomageParams>[] = [
  { validFrom: "2026-03-01", source: {...}, label: "Réforme 2026", values: {...} },
  // l'ancien jeu reste, avec validTo
];

// lib/chomage/eligibility/ — règles pures, testables
export interface RuleVerdict {
  status: "ok" | "warning" | "refer";     // jamais "refusé" — informatif
  ruleId: string;                          // "insertion.age-max"
  reasons: { messageKey: string; params?: Record<string, string | number> }[];
  sources: SourceRef[];
}
export type Rule<I> = (input: I, at: Date) => RuleVerdict;

// Catalogue documents justificatifs
export interface DocumentJustificatif {
  slug: string;                            // "attestation-etudes"
  titleKey: string;
  issuer: "user" | "employer" | "onem" | "school" | "external";
  howToObtainKey: string;                  // "demandez à votre école…"
  typicalDelayDays?: number;
}

// Bloc d'explication réutilisable (DB, traduit via ContentTranslation)
// model ExplanationBlock { key String @unique; title String; body String; sources Json; updatedAt DateTime }
```

Ce qui existe déjà et ne bouge pas : `DossierDefinition` (très bien conçu — il *référence* désormais règles et documents par id au lieu de les décrire), `PdfForm`/`PdfFormField` (schéma dual), `ConditionGroup` V2, `DecisionTree`/`Revision`, `BaremeFile`/`BaremeAmount`.

---

## Mission M — Pages

**Utilisateur** (existant ✅ / à créer ❌) : hub chômage ❌ (candidat : page builder) · orientation `/mon-dossier` ✅ (flag à activer) · fiche dossier/journey ✅ (généraliser) · wizard `/d/[slug]` ✅ · **écran de sortie/checklist finale ❌ (priorité)** · consultation barèmes ✅ · explications ⚠️ (blocs à unifier) · reprise ✅.

**Admin** : dossiers/bundles ✅ · PDF (complet : éditeur, révisions, test-generate, presets, organismes, analytics) ✅ · arbres ✅ · barèmes 8 onglets ✅ · i18n ✅ · **catalogue justificatifs ❌** · **santé des sources (params sans source, refs cassées, dossiers à re-vérifier après changement de règle) ❌** · simulateur de scénarios ❌ (Option 3).

**Partenaire** : réglementation ✅ (riche) · outils (AGR, planning) ✅ · **vue « règles en vigueur » (params + verdicts + sources, lisible conseiller) ❌ — sous-produit direct du domain**.

---

## Mission N — Composants UI

Existants : stepper/sections (`PdfFormRunner`), question card, warnings à sévérité, journey intro, array field, field error report, condition builder V2 (admin arbres), PDF field mapper (admin), preview/test-generate, code de reprise.

À créer : **`RuleSourceBadge`** (source + date de vérification, cliquable vers RioLex/ONEM) · **`ValidityBadge`** (« montants au 01/03/2026 ») · **`FinalChecklist`** (l'écran de sortie) · **`WhyThisQuestion`** (dépliable) · **`ReferBlock`** (« à vérifier avec votre organisme » + pourquoi) · `DocumentChecklistItem` branché sur le catalogue · (Option 3) éditeur de params admin + scenario tester.

---

## Mission O — Diagnostic final

1. **Ton idée est juste, ton diagnostic implicite est faux.** Tu penses avoir des fonctionnalités isolées à unifier ; tu as en réalité un système aux deux tiers construit avec **trois trous précis** : barèmes non réconciliés, règles éparpillées, sortie de parcours inexistante.
2. **À garder tel quel** : pdf-forms (excellent), Decision Builder, pipeline barèmes, DossierDefinition + journey, conditions V2, toute la couche RGPD.
3. **À changer** : extraire les constantes vers des params datés ; chaîner orientation → pré-qualif ; activer le runtime des arbres ; construire l'écran de sortie.
4. **À centraliser absolument** : params barèmes, catégories familiales, verdicts d'éligibilité, catalogue justificatifs, refs sources.
5. **À ne surtout pas dupliquer** : un 2e moteur de conditions, un moteur de règles en DB, des montants dans les composants React ou les messages i18n (les montants s'interpolent depuis les params).
6. **Architecture recommandée** : Option 1 maintenant, trajectoire Option 2. Pas d'Option 3 sans traction.
7. **Parcours recommandé** : hub → orientation (réponses conservées) → fiche journey → wizard mutualisé → feuille de route finale.
8. **Modules** : cf. Mission D — la seule création structurelle est `lib/chomage/` + catalogue justificatifs + blocs d'explication.
9. **Données** : cf. Mission L — le pattern clé est `VersionedParams<T>` + `SourceRef` + `RuleVerdict`.
10. **À créer en premier** : ① `lib/chomage/params.ts` + catégories + tests de non-régression ; ② test de parité DB↔code ; ③ montants insertion ; ④ écran de sortie ; ⑤ chaînage orientation→pré-qualif.
11. **Erreurs à éviter** : big-bang ; moteur de règles générique ; faire lire la DB par les calculateurs à chaud ; multiplier les éditeurs admin ; toucher aux comportements pendant l'extraction.
12. **Plan** : 5 lots ci-dessus, chacun ≤ 5 fichiers, `pnpm test` + `pnpm build` verts, un commit par lot.
13. **Prompt de démarrage** : voir ci-dessous.

### Prompt prêt pour Claude Code (lot 1)

> **Contexte** : audit `docs/audits/AUDIT_ARCHITECTURE_CHOMAGE_2026-07-04.md`. Objectif du lot : créer le socle domaine `lib/chomage/` SANS changer aucun comportement.
>
> 1. Crée `lib/chomage/categories.ts` : déplace `SituationFamiliale` et `ChomagePhase` depuis `lib/calculators/chomage.ts`, réexporte-les depuis leur emplacement actuel pour ne casser aucun import.
> 2. Crée `lib/chomage/params.ts` : type `VersionedParams<ChomageParams>` (`validFrom`, `validTo?`, `source: SourceRef`, `label`, `values`) ; un premier jeu `validFrom: "2026-03-01"` reprenant À L'IDENTIQUE les plafonds, taux et forfaits actuels de `lib/calculators/chomage.ts` ; fonction `getChomageParams(date: Date)`.
> 3. Refactore `lib/calculators/chomage.ts` pour lire ces params via `getChomageParams` au lieu des constantes locales. Interdiction de modifier un seul montant ou une formule.
> 4. Tests : les tests existants du calculateur doivent passer inchangés ; ajoute un test « résolution par date » (avant/après 2026-03-01 → jeu correct ou erreur explicite si aucune période ne couvre la date).
> 5. Contraintes projet : max 5 fichiers, pas de nouvelle dépendance, pas de `prisma db push`, `git add` explicite. Validation : `pnpm test` et `pnpm build`.
> 6. Ne fais RIEN d'autre (pas de parité DB, pas d'insertion, pas d'UI) — ce sont les lots 2 et 3.

Lots suivants : **Lot 2** = fixture d'export du BaremeFile publié + test de parité ; **Lot 3** = montants insertion dans les params + affichage dans le dossier live ; **Lot 4** = écran de sortie ; **Lot 5** = chaînage orientation → pré-qualification.
