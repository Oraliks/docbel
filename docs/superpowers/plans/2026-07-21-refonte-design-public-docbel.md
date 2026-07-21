# Refonte design complète du front public DocBel — Master Plan

> **Statut : vague publique V1 livrée le 21/07/2026.**
> Référence visuelle : [`docs/mockups/docbel-front-concepts.html`](../../mockups/docbel-front-concepts.html).
> Ce document est un plan directeur : chaque tâche d'exécution reste limitée à **3–5 fichiers** et doit produire un état vérifiable.

## Livraison du 21/07/2026

- Fondations glass, couleurs sémantiques, mouvement réduit et états de progression partagés.
- Accueil « guichet guidé », shell public, recherche/commande, catalogue d'outils et portail éditorial refondus.
- Parcours `/mon-dossier`, cockpit `/mes-demarches` et reprise anonyme harmonisés sur mobile et desktop.
- Gamification douce limitée à la progression et à la réussite ; aucun résultat réglementaire négatif n'est gamifié.
- Validation : build de production (235 pages), i18n, lint ciblé, smoke test de 12 vues et audit réglementaire sans anomalie P0/P1/P2.

Les outils métier complexes conservent volontairement leur logique et leur structure interne ; leur modernisation détaillée pourra être menée par lots dédiés après mesure d'usage et de performance.

## Objectif

Refondre l'expérience citoyenne publique autour du concept hybride validé :

1. **Guichet guidé** sur l'accueil et l'entrée dans une démarche.
2. **Cockpit citoyen** pour suivre, reprendre et terminer les démarches.
3. **Portail éditorial** pour comprendre les droits, consulter les actualités et utiliser les outils.

Le design doit être premium, rassurant, vivant et très lisible. Il doit donner le plaisir d'une interface de jeu — progression visible, feedback immédiat, petites récompenses — sans transformer les droits sociaux en jeu.

## Architecture produit retenue

```text
Accueil / recherche
        │
        ├── Situation connue ──> guichet / boussole ──> démarche recommandée
        │                                              │
        │                                              v
        ├── Démarche en cours ─────────────────> cockpit citoyen
        │                                              │
        │                                              v
        └── Besoin d'information ──> guides / outils / documents
                                                       │
                                                       v
                                              retour vers l'action
```

Le front public reste sous `.glass-root`. L'admin, les espaces pro et l'auth conservent la palette shadcn sans verre ; leur refonte éventuelle relève d'un plan séparé.

## Décisions produit non négociables

### Gamification douce

**Principe : gamifier la progression, jamais les droits sociaux.**

- La boucle d'interaction est : **comprendre → choisir → compléter → récupérer**.
- La récompense est le sentiment d'avancer, pas l'accumulation de points.
- Une étape terminée reçoit un feedback bref : coche, remplissage du rail, halo ou légère élévation.
- Un dossier entièrement prêt peut déclencher une célébration unique et sobre.
- Une inéligibilité, une erreur juridique ou un blocage administratif ne déclenche jamais de confettis, de score ni de formulation culpabilisante.
- Aucun classement, niveau, streak, badge de performance, compte à rebours artificiel ou contenu verrouillé pour créer de l'engagement.
- Les animations ne masquent jamais une source, une condition, un montant, un délai ou une action importante.

### Couleurs sémantiques

La palette existante est conservée et structurée par fonction :

| Rôle | Couleur / token cible | Usage |
|---|---|---|
| Action principale | violet DocBel / `--glass-accent-deep` | CTA, étape active, progression |
| Surface interactive | lavande/lilas | cartes, choix disponibles, zones explorables |
| Accompagnement | rose pâle | conseils, personnalisation, contenus secondaires |
| Succès | vert doux dédié | étape/document terminé, confirmation |
| Attention | ambre doux dédié | information à vérifier, échéance proche |
| Erreur | `--destructive` | erreur réelle, action impossible |

La couleur ne porte jamais seule le sens : elle est accompagnée d'un libellé, d'une icône ou d'un état textuel.

### Mouvement

| Interaction | Durée cible | Comportement |
|---|---:|---|
| Pression / feedback immédiat | 140–180 ms | échelle ou contraste très léger |
| Hover / focus / élévation | 180–220 ms | lift maximum 2–3 px, halo diffus |
| Changement d'étape | 320–420 ms | déplacement court + mise à jour du rail |
| Validation d'une étape | 360–520 ms | coche morphée + progression |
| Dossier complet | 600–900 ms, une fois | halo/particules très sobres, jamais en boucle |

- Une seule animation dominante à la fois.
- Aucun mouvement décoratif permanent près d'un formulaire ou d'un texte réglementaire.
- Les boucles décoratives du hero restent facultatives et peu contrastées.
- `prefers-reduced-motion` **et** `data-docbel-motion="reduced"` neutralisent animations et transitions.
- Le mode simple masque les décorations secondaires via `data-a11y-secondary="true"`.

### Confiance et anonymat

- Le parcours citoyen reste anonyme : cookie/code de reprise, jamais « connectez-vous pour sauvegarder ».
- Chaque résultat sensible conserve sa source et sa date de mise à jour visibles.
- Une seule action dominante par écran ; les alternatives restent secondaires.
- Toute erreur propose une prochaine action claire.

## Contraintes techniques

- Next.js 16, React 19, Tailwind 4, shadcn `base-nova` sur Base UI, lucide-react.
- Réutiliser les composants installés avant tout markup custom : `Card`, `Alert`, `Empty`, `Progress`, `Tabs`, `ToggleGroup`, `InputGroup`, `Skeleton`, `Sonner`, etc.
- Si `Progress` est ajouté via shadcn, consulter d'abord `pnpm dlx shadcn@latest docs progress`, puis utiliser le CLI ; aucun copier-coller GitHub.
- Sur Base UI, les compositions utilisent `render`, pas `asChild` ; les selects gardent `items` + `SelectGroup`.
- Pas de nouvelle bibliothèque d'animation : CSS/Tailwind et `tw-animate-css` suffisent.
- Toute nouvelle couleur passe par des variables sémantiques dans `app/globals.css`, jamais par des couleurs Tailwind brutes.
- Les formulaires utilisent `FieldGroup`/`Field`, `InputGroup` et `ToggleGroup` selon les conventions du dépôt.
- Pas de `bg-white`/`#FFFFFF` en dur dans le front public ; pas de `max-w-*`/`container`/`mx-auto` à la racine d'une page publique.
- Pas de migration DB. Les états de progression dérivent des sources existantes (`computeItemStatuses`, `rail-model`, `completedAt`).
- Pas de `setState` synchrone dans un `useEffect`.
- Textes user-facing via next-intl ; dates `JJ/MM/AAAA`, heures 24 h via les helpers existants.
- Les lots touchant le runtime d'orientation, le parcours chômage ou un contenu réglementaire déclenchent `/verif-reglementation` avant commit ; rapport informatif, jamais bloquant.

## Plans existants à réutiliser

Ce plan ne réimplémente pas ce qui est déjà spécifié :

- [`2026-07-19-parcours-mes-demarches.md`](2026-07-19-parcours-mes-demarches.md) : continuité, `/mes-demarches`, rail et guichet.
- [`2026-07-20-guichet-mon-dossier.md`](2026-07-20-guichet-mon-dossier.md) : recherche universelle et suppression des doublons sur `/mon-dossier`.

Au démarrage de chaque lot, vérifier ce qui est déjà livré et ne conserver que le delta visuel/interaction. Les helpers `DemarcheRail`, `FormStepper`, `computeItemStatuses` et `rail-model` sont des sources à étendre, pas à dupliquer.

---

## Ordre d'exécution

**Lot 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7.**

Chaque lot doit pouvoir être arrêté et livré seul. Les commits utilisent des chemins explicites ; jamais `git add -A`.

## Lot 0 — Baseline et contrat visuel

### Task 0.1 — Capturer la baseline

**Écrans à vérifier :** `/`, `/mon-dossier`, `/mes-demarches`, `/d/[slug]`, `/document/[...path]`, `/outils`, `/outils/[slug]`, `/actualites`, `/actualites/[slug]`, `/reprendre`.

- [ ] Capturer desktop large, tablette et mobile 360 px en clair et sombre.
- [ ] Noter pour chaque écran : CTA dominant, nombre de progressions visibles, surfaces dupliquées, texte sans prochaine action, animations en boucle et problèmes de contraste.
- [ ] Mesurer avant travaux : LCP/CLS, taille JS de la route, nombre de surfaces avec `backdrop-filter` et comportement à 200 % de zoom.
- [ ] Conserver la maquette validée comme cible de composition, pas comme source de code à copier.

### Task 0.2 — Figer le contrat dans la charte

**Files (3) :**
- Modify: `docs/context/DESIGN_RULES.md`
- Modify: `app/globals.css`
- Modify: `lib/glass-classes.ts`

- [ ] Ajouter à la charte les règles couleur/mouvement/gamification de ce plan.
- [ ] Définir les tokens succès, attention, information et mouvement pour light/dark.
- [ ] Regrouper les keyframes équivalentes ; ne pas créer une seconde variante de `fade-in-up`, lift ou shimmer.
- [ ] Étendre les helpers glass uniquement pour les compositions réellement répétées.
- [ ] Vérifier contraste normal + élevé et neutralisation reduced-motion.

**Validation :** `pnpm build`; inspection de `/`, `/outils`, `/admin` pour confirmer que l'admin n'hérite pas du glass.

## Lot 1 — Primitives partagées de progression et de feedback

### Task 1.1 — Progression unifiée

**Files (4–5) :**
- Modify: `components/docbel/demarche-rail.tsx`
- Modify: `components/pdf-forms/form-stepper.tsx`
- Create or add via shadcn if absent: `components/ui/progress.tsx`
- Create: `components/docbel/progress-feedback.tsx`
- Test: test ciblé du modèle/états si une logique pure est ajoutée

- [ ] Définir les états uniques : `done`, `current`, `available`, `locked`, `attention`.
- [ ] Afficher une seule progression principale par écran.
- [ ] Partager les libellés, icônes et attributs ARIA entre rail dossier et stepper formulaire.
- [ ] Animer uniquement le passage d'un état au suivant ; aucun mouvement au premier rendu.
- [ ] Rendre le rail compact sur mobile sans scroll horizontal.

### Task 1.2 — Feedback de complétion

**Files (3–4) :**
- Create: `components/docbel/completion-feedback.tsx`
- Modify: `app/globals.css`
- Modify: `lib/accessibility-preferences.ts` seulement si un comportement manque
- Test: test du déclenchement unique si un état persistant est introduit

- [ ] Variante `step` : coche + halo bref.
- [ ] Variante `dossier` : célébration sobre déclenchée une seule fois lorsque `allRequiredDone` devient vrai.
- [ ] Variante `information` : aucun effet festif.
- [ ] Ne stocker aucune donnée métier supplémentaire ; un marqueur `sessionStorage` est acceptable seulement pour empêcher une répétition dans la même navigation.
- [ ] En reduced-motion, remplacer l'animation par un changement d'état instantané et un message accessible.

### Task 1.3 — Copy i18n de progression

- [ ] Réutiliser en priorité les clés `public.dossier` existantes.
- [ ] Si de nouvelles clés sont indispensables, modifier les locales par lots de 4–5 fichiers maximum :
  1. `fr`, `nl`, `en`, `de`, `it` ;
  2. `es`, `pt`, `ru`, `sq`, `mk` ;
  3. `ar`, `tr`, `ro`, `bg`.
- [ ] Valider la syntaxe JSON à chaque batch et `pnpm i18n:check` après le dernier.

## Lot 2 — Shell public et navigation

### Task 2.1 — Header orienté tâches

**Files (4) :**
- Modify: `components/docbel/landing/header.tsx`
- Modify: `components/docbel/landing/command-palette.tsx`
- Modify: `components/docbel/app-layout-client.tsx`
- Modify: clés i18n ciblées

- [ ] Conserver les entrées principales : Accueil, Démarches, Mes démarches, Outils, Actualités.
- [ ] Mettre la recherche globale au premier plan sans alourdir le mobile.
- [ ] Retirer toute incitation à un compte citoyen ; conserver les accès pro/admin selon les règles existantes.
- [ ] Garder langue, thème, taille de texte, contraste, mode simple et mouvement réduit accessibles.
- [ ] États actifs corrects sur tout le funnel `/d`, `/document`, `/reprendre`.

### Task 2.2 — Footer et confiance

**Files (3–4) :**
- Modify: `components/docbel/landing/footer.tsx`
- Modify: `components/docbel/landing/trust-band.tsx`
- Modify: `components/docbel/announcement-banner.tsx` si nécessaire
- Modify: clés i18n ciblées

- [ ] Sources officielles, mise à jour, confidentialité, langues et accessibilité visibles sans badges décoratifs excessifs.
- [ ] Liens légaux réellement câblés ; aucune affirmation RGPD non vérifiée.
- [ ] Le footer reste calme : pas d'animation en boucle.

## Lot 3 — Accueil « Guichet guidé »

### Task 3.1 — Hero utile avant décoratif

**Files (4) :**
- Modify: `app/page.tsx`
- Modify: `components/docbel/landing/hero.tsx`
- Modify: `components/docbel/landing/hero-search.tsx`
- Modify: `components/docbel/landing/resume-strip.tsx`

- [ ] Question principale orientée situation : « Quelle démarche devez-vous faire aujourd'hui ? ».
- [ ] Recherche libre + CTA dominant ; exemples fréquents en actions secondaires.
- [ ] Si une démarche est en cours, afficher la prochaine action et non un simple pourcentage.
- [ ] Le décor du hero porte `data-a11y-secondary="true"` et s'arrête en reduced-motion.
- [ ] Les données restent server-side/fail-soft comme aujourd'hui ; aucun fetch client au premier paint.

### Task 3.2 — Situations, outils et contenu

**Files (5) :**
- Modify: `components/docbel/landing/wizard-teaser.tsx`
- Modify: `components/docbel/landing/tools-row.tsx`
- Modify: `components/docbel/landing/tool-card.tsx`
- Modify: `components/docbel/landing/bottom.tsx`
- Modify: `components/docbel/landing/trust-band.tsx`

- [ ] Hiérarchie : situations de vie → outils liés → guides/actualités → confiance.
- [ ] Les cartes de situation donnent un feedback tactile court et préremplissent réellement le guichet.
- [ ] Maximum une mise en avant « populaire » par groupe ; pas de pluie de badges.
- [ ] Chaque carte annonce clairement sa destination et son temps estimé lorsqu'il est fiable.
- [ ] Mobile : éviter les carrousels cachant des choix importants ; préférer une grille/reflow.

**Validation Lot 3 :** `/` clair/sombre, 360/768/1440 px, clavier, 200 % zoom, JS désactivé pour le contenu serveur critique.

## Lot 4 — Guichet et boussole

### Task 4.1 — Exécuter/absorber le plan guichet existant

**Files (4–5, selon delta réel) :**
- Modify: `app/mon-dossier/mon-dossier-client.tsx`
- Modify: `components/docbel/onboarding/dossier-wizard.tsx`
- Modify: `components/docbel/onboarding/intent-search.tsx`
- Modify: `components/docbel/onboarding/life-event-card.tsx`
- Modify: clés i18n ciblées

- [ ] Une seule recherche universelle, sans double question.
- [ ] Les situations fonctionnent comme des choix explicites, pas comme des cartes décoratives.
- [ ] Transition entre questions : courte, directionnelle et annoncée aux lecteurs d'écran.
- [ ] Afficher « pourquoi cette question ? » lorsque la donnée demandée semble sensible.
- [ ] Aucun résultat IA présenté comme décision juridique ; fallback local lisible quand l'IA est OFF.

### Task 4.2 — Préqualification et recommandation

**Files (4) :**
- Modify: `components/docbel/onboarding/eligibility-prequalifier.tsx`
- Modify: `components/docbel/onboarding/bundle-warnings.tsx`
- Modify: `components/docbel/onboarding/allocation-estimate-block.tsx`
- Modify: `components/docbel/progress-feedback.tsx`

- [ ] Reprendre les réponses connues et signaler ce qui a été prérempli.
- [ ] Feedback positif à la validation d'une réponse, jamais à l'éligibilité elle-même.
- [ ] Avertissements via `Alert`, avec conséquence et prochaine action.
- [ ] Résultat recommandé : titre, raison, sources, étapes, durée estimée et CTA.
- [ ] Lancer `/verif-reglementation` avant commit.

## Lot 5 — Cockpit « Mes démarches » et documents

### Task 5.1 — Cockpit citoyen

**Files (5) :**
- Modify: `app/mes-demarches/page.tsx`
- Modify: `components/docbel/mes-demarches-client.tsx`
- Modify: `components/docbel/demande-list.tsx`
- Modify: `components/docbel/demarche-rail.tsx`
- Modify: `components/docbel/onboarding/resume-form.tsx`

- [ ] Mettre la prochaine action avant les métriques.
- [ ] Afficher les démarches actives, terminées et abandonnées sans faux sentiment de compétition.
- [ ] Le code de reprise est copiable, compréhensible et jamais présenté comme un mot de passe.
- [ ] Chaque démarche expose : état, dernière activité, prochain document, temps estimé si fiable.
- [ ] Empty state via `Empty`, avec CTA « Commencer une démarche ».

### Task 5.2 — Dossier et formulaires PDF

**Files (4) :**
- Modify: `components/docbel/bundle-runner.tsx`
- Modify: `components/docbel/demarche-rail.tsx`
- Modify: `components/pdf-forms/form-stepper.tsx`
- Modify: `components/pdf-forms/pdf-form-runner.tsx`

- [ ] Unifier le rail global et le stepper local sans afficher deux pourcentages concurrents.
- [ ] À la validation d'un document, l'ajouter visuellement à la pile du dossier et avancer le rail.
- [ ] Le verrou tout-ou-rien est annoncé avant l'étape de téléchargement.
- [ ] Le dossier complet déclenche `CompletionFeedback` une seule fois puis présente les actions ZIP/email.
- [ ] Les erreurs de génération/sauvegarde utilisent `Alert`/toast avec récupération possible.

**Validation Lot 5 :** scénarios 0 %, partiel, complet, document conditionnel masqué, reprise par code, erreur réseau, refresh après complétion. Lancer `/verif-reglementation` si le runtime d'orientation ou les conditions sont touchés.

## Lot 6 — Portail outils et éditorial

### Task 6.1 — Catalogue d'outils

**Files (4–5) :**
- Modify: `app/outils/page.tsx`
- Modify: `app/outils/outils-catalog-client.tsx`
- Modify: `app/outils/[slug]/page.tsx`
- Modify: `app/outils/[slug]/legacy-tool-view.tsx`
- Modify: `app/outils/[slug]/disabled-tool-view.tsx`

- [ ] Recherche et catégories visibles ; favoris secondaires.
- [ ] Cartes homogènes : objectif, public, durée, source/date si réglementaire.
- [ ] Un outil désactivé propose une alternative ou un retour au catalogue.
- [ ] Aucun calcul métier modifié dans ce lot.
- [ ] Migrer les outils spéciaux par vagues de 3–5 fichiers, pas dans un commit global.

### Task 6.2 — Pages éditoriales

**Files (4) :**
- Modify: `app/actualites/page.tsx`
- Modify: `app/actualites/[slug]/page.tsx`
- Modify: `components/docbel/actualites-view.tsx`
- Modify: `components/docbel/article-view.tsx`

- [ ] Positionner recherche/thèmes avant la liste de contenus.
- [ ] Afficher source, date fixe, temps de lecture et dernière mise à jour.
- [ ] Ajouter un CTA contextuel vers la démarche ou l'outil associé, sans interrompre la lecture.
- [ ] Animation limitée à l'entrée et à la progression de lecture ; le corps réglementaire reste stable.
- [ ] Lancer `/verif-reglementation` si un texte affirmant conditions, montants ou durées est modifié.

### Task 6.3 — Outils complexes

Traiter séparément `/outils/bureaux`, barèmes, lookup ONEM et calculateurs. Pour chaque famille :

- [ ] Conserver sa logique et ses tests métier.
- [ ] Appliquer le shell commun : titre, source/date, formulaire, résultat, explication, actions.
- [ ] Réutiliser les loaders métier existants (radar/GPS) seulement lorsqu'ils expliquent réellement l'attente.
- [ ] Aucun effet festif sur un montant ou une conclusion réglementaire.

## Lot 7 — Accessibilité, performance et livraison

### Task 7.1 — Matrice d'accessibilité

**Files (3–5) :**
- Modify: `lib/accessibility-preferences.ts` si nécessaire
- Modify: `components/docbel/landing/header.tsx`
- Modify: `app/globals.css`
- Create/modify: test e2e public ciblé

- [ ] Clavier complet, focus visible, ordre DOM cohérent.
- [ ] Lecteur d'écran : annonce des changements d'étape et validations via une seule live region.
- [ ] Textes petits ≥ 11 px ; cibles tactiles ≥ 44 px quand possible.
- [ ] 200 % zoom, taille XL, contraste élevé, mode simple, reduced-motion.
- [ ] RTL arabe : rail, flèches, ordre des groupes et transitions directionnelles.

### Task 7.2 — Budget performance

- [ ] Aucun nouveau package d'animation.
- [ ] Pas de `backdrop-filter` sur chaque ligne d'une liste ; une surface par groupe, pas de verre imbriqué.
- [ ] Limiter les éléments animés simultanés dans le hero et les couper hors écran.
- [ ] Préserver les server components et les fetchs parallèles de l'accueil.
- [ ] Pas de layout shift lors des changements d'étape ou du chargement d'images.
- [ ] Cible indicative : LCP mobile ≤ 2,5 s, CLS ≤ 0,1 sur preview représentative.

### Task 7.3 — Tests et rollout route par route

- [ ] Exécuter : `pnpm test`, `pnpm build`, `pnpm i18n:check`.
- [ ] Exécuter `pnpm lint` et vérifier qu'aucune nouvelle erreur n'est ajoutée.
- [ ] Vérifier chaque lot en clair/sombre sur 360, 768, 1440 et ≥1600 px.
- [ ] Déployer/valider d'abord le shell + accueil, puis guichet, cockpit, formulaires, outils et éditorial.
- [ ] Après chaque vague, supprimer uniquement les styles devenus réellement orphelins ; pas de grand nettoyage opportuniste.

## Critères d'acceptation globaux

1. Un nouveau visiteur identifie en quelques secondes où décrire sa situation.
2. Un visiteur ayant une démarche en cours voit immédiatement la prochaine action.
3. Aucun écran ne présente deux progressions concurrentes.
4. Chaque action donne un feedback visuel et accessible, y compris en reduced-motion.
5. La complétion est gratifiante ; l'inéligibilité et les erreurs restent neutres et respectueuses.
6. Les sources, dates et avertissements restent plus visibles que les effets décoratifs.
7. Le front public respecte le glass mauve ; admin/pro/auth ne reçoivent aucun verre.
8. Aucun parcours citoyen ne dépend d'une connexion.
9. Le site reste utilisable à 320 px, au clavier, en RTL et à 200 % de zoom.
10. Aucun calcul, condition réglementaire, binding PDF, donnée ou route API n'est modifié par effet de bord.

## Risques et mitigations

| Risque | Mitigation |
|---|---|
| Sur-gamification d'un sujet sensible | liste d'interdictions explicite + revue UX des états négatifs |
| Prolifération d'animations CSS | tokens/durations centralisés, primitives partagées, suppression des doublons |
| Performance du glass sur mobile | pas de verre imbriqué, surfaces groupées, mesure avant/après |
| Régression des parcours déjà livrés | réutiliser `rail-model`/`computeItemStatuses`, tests par états |
| Incohérence entre pages | shell et primitives avant migration route par route |
| Textes trop longs en 14 langues | reflow testé, pas de largeur fixe, lots i18n dédiés |
| Dark mode trop « gaming » | glow réservé aux actions/étapes actives, aucune bordure RGB décorative |

## Hors périmètre

- Refonte admin, pro et auth : plan séparé, palette shadcn sans glass.
- Nouvelle mascotte, système de points, profil citoyen connecté ou notifications push.
- Nouvelle bibliothèque d'animation, PWA ou application mobile native.
- Modification des règles de calcul, conditions d'éligibilité, montants ou bindings PDF.
- Refonte du page-builder admin ; seules les pages publiques rendues par ses blocs peuvent recevoir le shell commun.

## Résultat attendu

DocBel doit donner l'impression d'un accompagnateur administratif vivant : il montre le chemin, explique pourquoi une étape existe, célèbre sobrement ce qui est terminé et transforme progressivement les réponses en documents utilisables — sans jamais banaliser l'impact réel d'une décision administrative.
