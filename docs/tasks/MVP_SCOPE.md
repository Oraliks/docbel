# MVP_SCOPE — Périmètre V1 publique de DocBel

But : décider **ce qui doit marcher pour publier**, et **ce qu'on repousse**. Strict.
Le code contient bien plus que le MVP : la difficulté n'est pas de construire, c'est de
**recentrer et fiabiliser** un sous-ensemble publiable.

## MVP public obligatoire
- **Accueil clair** + point d'entrée unique vers les démarches.
- **Onboarding / boussole** (`/onboarding`) : recherche libre + grille événements de vie.
- **Dossiers dynamiques** (BundleRunner) : warnings + pré-qualif + parcours.
- **Reprise de dossier** par code (`/reprendre`).
- **Contenus administratifs fiables** : actualités + outils/calculateurs **dont les
  montants sont vérifiés** (cf. tests calculateurs en dette).
- **Conformité RGPD minimale publiable** (BLOQUANT) : mentions légales, politique
  confidentialité, politique cookies, footer câblé, bannière consentement, Analytics gated.
  → `docs/tasks/RGPD_QUEUE.md` section « avant publication ».
- **Sécurité minimum** : secret NRN sans fallback, headers HTTP, rate-limit endpoints
  publics. → `docs/tasks/SECURITY_QUEUE.md`.

## MVP admin obligatoire
- Gérer **dossiers / bundles** (catégories, questions de pré-qualif, warnings, conditions).
- Gérer **actualités** et **outils**.
- Gérer **utilisateurs** (statuts/rôles).
- Éditer les **barèmes** (préavis, etc.) avec traçabilité de source/date.

## Utile mais pas bloquant V1
- Page-builder avancé (au-delà des pages légales).
- IA d'intent-detection (fallback local suffit si désactivée — voir RGPD transfert US).
- Espaces pro **lecture/dashboard** simples.
- Multilingue au-delà de FR/NL (le fallback FR couvre le reste).

## À repousser (post-V1)
- Chat IA avancé + RAG sémantique complet (déjà livré mais non nécessaire au lancement).
- Voice input (Whisper) — implique transfert audio US (RGPD).
- Espace partenaire/employeur **complet** (booking équipe, outils FGTB, AGR, contrats…).
- Éditeur flowchart drag & drop (React Flow).
- Statistiques avancées.
- Impersonation V3 / Decision Builder runtime (garder derrière flag).
- Migrations majeures de dépendances (Prisma 7, TipTap 3, etc.).

## À fusionner / clarifier (réduire la surface)
- Rôle `moderator` : inutilisé → décider (retirer de l'enum à terme, ou lui donner un sens).
- `requirePartnerOrAdminAuth` : défini, 0 usage → brancher ou retirer.
- Scripts `debug-*.ts` : clarifier lesquels gardent une valeur, archiver le reste.
- Features IA derrière toggles : s'assurer qu'elles **dégradent proprement** quand OFF
  (intent-detect, voice) pour pouvoir publier sans elles.

## Critère « publiable »
1. RGPD section « avant publication » = toutes cases cochées.
2. Quick wins sécurité P1 faits.
3. Calculateurs exposés = couverts par tests (montants légaux).
4. Parcours citoyen accueil→onboarding→dossier→reprise testé de bout en bout.
