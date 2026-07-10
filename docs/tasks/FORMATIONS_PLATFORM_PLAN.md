# Plan — Docbel Formations : passer de « module interne » à plateforme ouverte

> **Objectif.** Que n'importe quel organisme — école, ASBL, société privée/publique,
> administration, formateur indépendant — puisse présenter ses formations sur Docbel
> (et via Docbel sur son propre site), en self-service, avec la validation Docbel
> comme garantie de qualité.
>
> **Rédigé le 2026-07-10.** Le module est volontairement en `launchMode=HIDDEN`
> (test en cours) : fenêtre idéale pour ce chantier avant ouverture publique.

---

## 0. Où on en est — et LE verrou

### Déjà livré (V1+V2, sur main)
- Catalogue public + fiche + Boussole d'orientation + `/mon-espace/formations`.
- Espace org (`/employeur/formations`, `/partenaire/formations`) : wizard 6 étapes,
  sessions, inscriptions (accepter/refuser/liste d'attente/présence), export CSV.
- Workflow admin complet (validation, permissions 20 capacités, catégories/tags/badges,
  Boussole configurable) + activation module + 19 feature flags + providers
  mock/manual/local (paiement, IA, notifications, PDF).
- Attestations PDF + vérification publique (`/formations/certificats/verifier/[code]`),
  journal notifications, événements analytics, i18n UI (pass récent).
- Signalements désormais unifiés dans l'infra Report globale (`/admin/signalements`).

### LE verrou : l'entrée des organismes
Aujourd'hui, une organisation ne peut exister **que** via un compte `partner`/`employer`
créé par l'admin (pont `User.partnerOrganization` → `FormationOrganization`).
**Une école ou une ASBL n'a aucun chemin pour entrer seule.** Tout le reste du plan
est du levier ; ce point est la condition. C'est le Lot A.

### Atouts déjà dans le repo (à réutiliser, pas à recréer)
| Besoin plateforme | Existe déjà |
|---|---|
| Vérifier une entreprise (n° BCE) | Tables `KboEnterprise/KboDenomination` + `/api/documents/bce/[number]` |
| Upload logo/cover/PDF programme | Système Files (`/api/files/upload`, Vercel Blob, quotas) |
| Description riche | Tiptap (utilisé par News) + DOMPurify |
| Export calendrier sessions | `lib/booking/ics-adapter` + `lib/rendez-vous/ics` |
| Rappels / purge planifiés | Patterns cron booking (`booking-reminders`, `booking-purge`) |
| Facturation orgs (TVA) | `vatNumber` + normalisation TVA employeur + flag `billing_enabled` |
| Recherche performante | Expérience pg_trgm/FTS (lookup ONEM, RioLex) |
| Dashboard org | Grammaire visuelle admin cockpit (KPIs compacts, recharts) |
| Notifications in-app | `TrainingNotificationLog` déjà alimenté (il ne manque que l'UI) |
| Analytics | `TrainingAnalyticsEvent` déjà alimenté (il ne manque que l'UI) |
| Multi-tenant public | Pattern BookingTenant (`/{slug}/rendez-vous`) |

---

## 1. Vision cible

**« Le Eventbrite/Doctolib de la formation en Belgique, avec la Boussole comme
différenciateur. »** Trois promesses :
1. **Citoyen** : je trouve une direction (Boussole) puis une formation vérifiée, je
   m'inscris en 2 minutes, mes attestations sont vérifiables.
2. **Organisme** : je crée mon compte seul, mon profil public est ma vitrine, je
   gère sessions/inscriptions, et **j'affiche mon catalogue Docbel sur MON site**
   (widget embarquable) — Docbel devient mon système de présentation de formations.
3. **Docbel** : la validation + le label = la confiance ; monétisation par paliers
   (freemium → Pro → featured), sans jamais dégrader la pertinence.

---

## 2. Lot A — Onboarding self-service des organismes ⭐ *(le déblocage)*

**Objectif : une école s'inscrit un mardi soir sans intervention manuelle de ta part
(sauf la validation finale).**

1. **Parcours public « Proposer vos formations »** (`/formations/proposer` + CTA
   catalogue/landing) : type d'organisme (école, ASBL, société, administration,
   organisme de formation, formateur), **n° BCE avec vérification KBO automatique**
   (pré-remplit dénomination/adresse ; badge « BCE vérifié »), contact, description.
2. **Compte & espace dédiés** : nouveau segment `organisme` avec son espace ProShell
   (`/organisme/formations`) — les server-pages formations sont déjà factorisées par
   segment, ajouter un 3ᵉ segment est un ajout localisé (`pro-nav.ts`,
   `app-layout-client.tsx`, `getOrgPageUser`). *Décision D1 ci-dessous.*
3. **File d'attente admin** : org créée en `status=pending` → onglet « Organismes à
   valider » dans `/admin/formations` (vérif BCE affichée, approuver/refuser/note).
   Permissions par défaut inchangées (privé/interne/publication directe OFF).
4. **Équipe & invitations** : flux d'invitation par email avec token
   (`FormationOrgMember` existe déjà ; copier l'UX booking `/equipe`), rôles
   owner/manager/trainer/viewer déjà en place, page « Mon équipe ».
5. **Profil self-service** : logo (Files), description, site, email de notification.

**Effort : M-L.** Migration additive n°50 (invitations + champs vérification org).
**Sans ce lot, « tout le monde peut utiliser le système » reste théorique.**

---

## 3. Lot B — Vitrine & distribution *(l'argument d'adoption)*

1. **Profil public organisme** `/formations/organismes/[slug]` : logo, badges
   (vérifié BCE, Docbel Certified), description, formations publiées, prochaines
   sessions. C'est la « page vitrine » que l'école partage.
2. **Widget embarquable** ⭐ : `/embed/organismes/[slug]` (route iframe-safe, thème
   neutre clair, CSP/X-Frame-Options assouplis sur ce chemin uniquement) + script
   d'intégration une-ligne. **L'école affiche SON catalogue sur SON site, alimenté
   par Docbel** — c'est ce qui transforme Docbel en « système de présentation »
   utilisé par d'autres, pas juste un annuaire de plus.
3. **SEO sérieux** : JSON-LD schema.org `Course`/`CourseInstance` sur les fiches,
   entrées sitemap pour formations+organismes publiés, OG images par formation,
   metadata propres. Les formations doivent sortir sur Google — acquisition gratuite
   pour les organismes = raison de publier chez toi.
4. **ICS** : « Ajouter au calendrier » par session + flux ICS par organisme
   (réutilise l'adaptateur booking).
5. **Médias réels** : remplacer les champs URL (cover/logo/PDF programme) par upload
   Files ; **QR code** de partage par formation (lib `qrcode`, servira aussi aux
   certificats V3).

**Effort : M.** Aucun changement de schéma sauf champs mineurs.

---

## 4. Lot C — Contenu riche & multilingue

1. **Description Tiptap** (sanitizée) au lieu du textarea — les organismes ont des
   programmes structurés (listes, titres, tableaux).
2. **Traductions de contenu FR/NL** (indispensable Belgique) : table
   `TrainingTranslation(trainingId, locale, title, shortDescription, description,
   objectives)` + onglet langue dans le wizard + fallback FR + badge « NL » sur les
   cartes. S'aligner sur le chantier i18n global (l'UI vient d'être internationalisée ;
   ceci couvre le **contenu**). Pré-traduction Claude proposée dans le wizard,
   relecture par l'organisme.
3. **Mini-LMS (V3 du spec, flags `lms`/`quizzes` déjà en place)** : modules/leçons
   (texte, vidéo externe, PDF, lien), progression, quiz simples → certificat.
   À faire **après** A+B : inutile d'avoir un LMS sans organismes.
4. **Parcours** (`TrainingPath`) : multi-formations recommandés depuis la Boussole
   (« Retour à l'emploi », « Se remettre à niveau numérique »…).

**Effort : S (Tiptap) / M (traductions) / L (LMS+parcours).** Migrations additives.

---

## 5. Lot D — Confiance & qualité à l'échelle

*(Tu es seul : tout ce qui n'est pas automatisé finira par déborder.)*

1. **Avis vérifiés** : table `TrainingReview` déjà en base ; UI de dépôt (réservé aux
   inscrits `completed`), modération admin, réponse de l'organisme. Interne d'abord,
   public via flag.
2. **Score qualité** (flag `qualityScore`) : cron qui calcule complétion, présence,
   signalements, fraîcheur des sessions, délai de réponse org → visible admin
   d'abord, public ensuite.
3. **Automatisations** : sessions passées auto-archivées ; scan liens morts (réutilise
   le scanner médias) ; **rappel J-2 aux inscrits** (pattern booking-reminders) ;
   relance organisme si inscriptions non traitées > 72 h ; alerte formation sans
   session ouverte depuis X mois.
4. **RGPD** : purge des inscriptions N mois après la session (pattern booking-purge),
   minimisation des données participants, mention sous-traitance dans les CGU
   organismes, registre de traitement mis à jour.

**Effort : M.** Surtout des crons + petites UIs.

---

## 6. Lot E — Monétisation & API *(quand il y a de la traction)*

1. **Paliers organisme** (aligné vision access-model freemium→payant) :
   - **Gratuit** : X formations actives, listing standard, inscriptions, attestations.
   - **Pro** : illimité, stats avancées, export, widget embarquable brandé, priorité
     de validation. Facturation : réutiliser TVA + `billing_enabled`.
   - **Featured/sponsorisé** (flags déjà en place) : encarts clairement marqués,
     jamais au détriment de la pertinence.
2. **Paiement des inscriptions** : rester `manual`/lien externe tant que volume
   faible ; **Stripe Connect** (commission `DOCBEL_COMMISSION_RATE`) quand des
   organismes le demandent — l'abstraction provider est prête.
3. **API partenaire** (flag `partnerApi`) : clés hashées + scopes (schéma prévu),
   lecture d'abord (mes formations/sessions/inscriptions), écriture ensuite,
   rate-limit. Cible : écoles avec leur propre SI.
4. **Import en masse** : CSV/Excel de formations+sessions (dépendance `xlsx` déjà là,
   pattern import barèmes) — onboarding indolore d'écoles avec catalogues existants.

**Effort : L.** À ne lancer qu'avec de vrais organismes actifs.

---

## 7. Lot F — Ops, notifications, analytics, perfs

1. **Cloche notifications in-app** : `TrainingNotificationLog` est déjà rempli — il
   manque l'UI (liste + read state) dans le ProShell et l'espace citoyen. *(S)*
2. **Dashboard organisme** : vues, inscriptions, taux d'acceptation/remplissage,
   provenance Boussole — `TrainingAnalyticsEvent` est déjà rempli, grammaire admin
   cockpit à réutiliser. *(M)*
3. **Recherche** : pg_trgm/FTS sur titre+description+organisme, facettes, tri
   pertinence (patterns lookup/RioLex). *(M)*
4. **Perfs** : cache/revalidate sur le catalogue (aujourd'hui force-dynamic),
   pagination réelle au-delà de ~60 cartes. *(S)*
5. **Tests E2E Playwright** des parcours critiques (inscription org → création →
   validation → inscription citoyen → attestation). *(M)*

---

## 8. Décisions à trancher (Oraliks)

| # | Décision | Recommandation |
|---|---|---|
| D1 | Compte organisme : **segment dédié `organisme`** (espace ProShell propre) vs partnerType sous `partner` | **Segment dédié** — une école n'a rien à faire dans l'espace partenaire (RioLex, outils FGTB) ; coût modéré car nav/guards/pages déjà factorisés par segment |
| D2 | Validation d'organisme : manuelle vs auto si BCE vérifié | **Manuelle au début** (tu es la garantie qualité), auto plus tard pour types à faible risque |
| D3 | Frontière Gratuit/Pro (nb formations actives ? widget ? stats ?) | Gratuit généreux (3-5 formations actives), widget + stats en Pro |
| D4 | Contenu NL : obligatoire pour publier ? | **Optionnel** avec badge « disponible en NL » (l'obligation tuerait l'adoption) |
| D5 | Paiement inscriptions : seuil de passage à Stripe Connect | Rester manual/externe jusqu'à demande explicite de plusieurs organismes |
| D6 | Widget embarquable : tous les organismes vérifiés ou réservé Pro ? | **Tous les vérifiés au lancement** (c'est le moteur d'adoption), brandé Docbel ; version white-label en Pro |

---

## 9. Ordre recommandé & quick wins

**Séquence (pendant que le module est HIDDEN) :**
`A (onboarding)` → `B (vitrine+embed+SEO)` → `F1-F2 (notifs+dashboard org)` →
**réouverture publique** → `C (contenu/NL)` → `D (confiance/automatisations)` →
`E (monétisation/API)`.

**Quick wins indépendants (faisables tout de suite, S chacun) :**
- JSON-LD + sitemap formations (SEO)
- Upload médias via Files au lieu d'URLs
- Invitations membres (token email)
- ICS « ajouter au calendrier »
- Cron rappel J-2 + auto-archivage sessions passées
- Cloche notifications (l'infra existe)
- Description Tiptap

---

## 10. Critères « final » & KPIs

Le système est « ouvert à tous » quand :
1. Un organisme inconnu s'inscrit, est vérifié BCE, invité son équipe, publie une
   formation validée et gère ses inscriptions **sans aucune intervention manuelle
   hors validation**.
2. Son catalogue est visible sur Google (JSON-LD indexé) ET sur son propre site (widget).
3. Un citoyen s'inscrit, reçoit rappel J-2, attestation vérifiable.
4. Toi : file de validation < 48 h, zéro tâche récurrente manuelle (crons),
   signalements/qualité sous contrôle.

**KPIs** : organismes actifs, formations publiées, délai médian de validation,
inscriptions/mois, % sessions avec rappel envoyé, trafic SEO fiches, installations
du widget.

## 11. Risques
- **Charge de modération (solo)** → validation manuelle assumée + automatisations
  Lot D dès que possible ; anti-spam à l'inscription org (BCE requis ou review).
- **RGPD** → rétention inscriptions + CGU organismes AVANT l'ouverture publique.
- **Base Neon partagée** → toutes migrations additives (`db execute`), numéros 50+.
- **Dérive marketplace** → flags : chaque étage (paiement, sponsorisé, API) reste
  désactivable indépendamment.
