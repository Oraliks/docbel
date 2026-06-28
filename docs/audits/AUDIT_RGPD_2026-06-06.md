# 🛡️ Audit RGPD — beldoc

## 📊 Synthèse exécutive

**beldoc est un site en production publique (`docbel.be` / `beldoc.be`) qui traite des données massivement sensibles** — NRN (registre national), dossiers de chômage, adhésion syndicale (FGTB/CSC/CGSLB), adhésion mutualiste, données bancaires (IBAN), correspondance avec des syndicats — **sans aucune des fondations légales requises** par le RGPD et l'art. 129 de la loi belge du 13 juin 2005. Aucune page de mentions légales, aucune politique de confidentialité, aucun banner de consentement, aucun responsable de traitement identifié, aucun DPO, aucune mention de l'APD belge. En contrepartie, les **fondations techniques de sécurité sont solides** (NRN HMAC + AES-GCM, bcrypt, lockout brute-force, validation Zod systématique, sanitization HTML isomorphe, rate-limit applicatif, purge booking 180j/730j) — ce qui rend la non-conformité encore plus frustrante : l'effort restant est documentaire et organisationnel, pas une refonte technique.

**Note de conformité globale : 3,5 / 10.** Justification : la base technique RGPD-by-design (art. 25, 32) est entamée correctement (+3 points), la purge booking est exemplaire (+0,5), mais l'absence totale de transparence (art. 12-14), l'absence de gestion du consentement art. 9 (syndicat/mutuelle/santé), l'absence de mécanisme de droits art. 15-22, et l'absence de banner cookies/CMP plombent la note. Tout site équivalent en B2C belge en activité serait actuellement non-publiable.

**Top 3 risques sanctionnables (APD belge — ordres de grandeur récents)** :
1. **Pas de banner cookies + Vercel Analytics sans consentement préalable** (`app/layout.tsx:3,77`) → Décisions APD 19/2021, 81/2023 sur des sites comparables : **50 000 € à 200 000 €** + mise en demeure publique.
2. **Adhésion syndicale collectée sans consentement explicite art. 9 §2 a** (booking FGTB/CSC/CGSLB + `UserProfile.organismePaiement`) → infraction art. 9 RGPD : **100 000 € à 600 000 €** (cf. décision 116/2022 APD sur catégorie particulière).
3. **NRN traité sans autorisation Comité sectoriel SPF Intérieur** (loi 8 août 1983) + stockage en clair dans `UserProfile.niss` → infraction spécifique BE : **mise en demeure obligatoire + amende 10 000 € à 50 000 €**, et exposition à un signalement administratif au SPF Intérieur.

Plafond RGPD théorique applicable : **20 000 000 € ou 4 % du CA mondial** (art. 83.5). En pratique sur un site solo dev, l'APD négocie d'abord la mise en conformité 30 jours avant amende.

---

## ⚡ Top 5 actions URGENTES (à faire cette semaine)

1. **Désactiver `<Analytics />` IMMÉDIATEMENT** ou le placer derrière un consent gate. Édit minimal :
   - Commenter `app/layout.tsx:3` et `app/layout.tsx:77` (la ligne `<Analytics />`).
   - Désactiver également `<PageViewBeacon />` chargé via `app/[slug]/page.tsx:9` jusqu'à la mise en place du CMP.
   - Cela seul élimine le risque sanction P0 le plus immédiat le temps de la mise en conformité.

2. **Créer `/mentions-legales`, `/politique-confidentialite`, `/politique-cookies`** via le page-builder existant ou comme routes Next dédiées. Tirer parti du template `legal` déjà présent dans `lib/page-builder/page-templates.ts:614-655`. Remplir avec : raison sociale + BCE + siège + email DPO/contact + identité responsable de traitement. Remplacer les 3 `href="#"` du footer `components/docbel/landing/footer.tsx:22-39`.

3. **Corriger la déclaration trompeuse `lib/app-settings.ts:58-59`** (« Aucun cookie de pistage tiers ») — texte actuellement factuellement faux puisque Vercel Analytics est chargé. C'est une fausse déclaration au sens de l'APD, à corriger même si le tracker est désactivé temporairement.

4. **Bloquer le démarrage si `BOOKING_NRN_SECRET` est absent** — éditer `lib/booking/crypto-nrn.ts:8-12` et `lib/booking/dedupe.ts:14-18` pour supprimer le fallback hardcodé `"docbel-booking-nrn-fallback"` et `throw` au boot. Régénérer le secret et le pousser sur Vercel envvars.

5. **Brancher `app/api/booking/[slug]/book/route.ts:143-144` sur `crypto-nrn.encryptNrn()`** — la colonne `citizenNrnEnc` (migration 37) est jamais écrite. Soit on l'écrit (route nrn/route.ts pourra déchiffrer à la demande), soit on supprime la colonne pour éviter un cas zombie. Recommandé : écrire, puis ajouter `nrnEnc: null` dans le cron de purge `app/api/cron/booking-purge/route.ts:34-44`.

---

## 🔍 Audit détaillé par axe

### Axe 1 — Bases légales & finalités (RGPD art. 5, 6, 9)

**Constats :**
- 🔴 **Aucune base légale documentée** pour les traitements identifiés. Pas de registre art. 30, pas de cartographie interne. Les bases qui *seraient* applicables sont implicites :
  - Booking citoyen public → ni contrat ni intérêt légitime explicite, et certainement pas consentement (jamais demandé). `app/api/booking/[slug]/book/route.ts`.
  - `UserProfile` → contrat (acceptable pour identité de base, **mais pas pour `organismePaiement`/`mutuelleCode`** qui sont art. 9). `app/api/user/profile/route.ts:38-49`.
  - PDF Forms → consentement OK (case bloquante côté client `components/pdf-forms/pdf-form-runner.tsx:448-454` ET serveur `app/api/pdf/[slug]/generate/route.ts:45-47`).
  - `/api/intent-detect` → **base inexistante** pour transfert hors UE vers Anthropic US (`app/api/intent-detect/route.ts:144`).
- 🔴 **Violation art. 9 RGPD** : adhésion syndicale (`UserProfile.organismePaiement` ∈ {fgtb, csc, cgslb, capac} stocké en clair `prisma/schema.prisma:1096`) et adhésion mutualiste (`mutuelleCode` ∈ {solidaris, mc, mloz, mutlibres, neutrales} `prisma/schema.prisma:1098`) traitées **sans consentement explicite ni exception §2 b-j applicable**.
- 🔴 **Le simple fait de prendre RDV chez FGTB/CSC/CGSLB révèle l'adhésion syndicale** (déduction automatique du tenant `lib/booking/status.ts`) — donnée art. 9 collectée sans information ni consentement, alors qu'aucune des exceptions §2 ne peut être invoquée par un éditeur tiers.
- 🟠 **Finalités non explicitées à l'utilisateur** : aucun formulaire (sauf PDF Forms et contact) ne mentionne sa finalité précise au point de collecte.
- 🟢 **Bon point** : `redactSensitiveFormData()` dans `lib/booking/form-fields.ts:155-168` applique le principe de minimisation (art. 5.1.c) sur le NRN avant persistance JSON.
- 🟢 **Bon point** : `payloadHash` SHA256 plutôt que payload clair dans `PdfFormSubmissionLog` (`prisma/schema.prisma:1793`) — bonne application art. 5.1.c.

📜 **Articles concernés** : RGPD art. 5 (licéité, minimisation, finalité limitée), art. 6 (base légale), art. 9 (catégories particulières), art. 25 (privacy by design).

✅ **Plan de remédiation :**
1. Rédiger un **registre des traitements** (Notion/PDF interne) listant pour chaque traitement : finalité, base légale, catégories de données, destinataires, durée, mesures techniques. Voir Axe 6.
2. Pour booking FGTB/CSC/CGSLB : ajouter dans `app/[slug]/rendez-vous/booking-flow.tsx` une case **non pré-cochée** : « Je donne mon consentement explicite à beldoc pour transmettre ma demande à [Tenant] et stocker mes données pour ce rendez-vous (RGPD art. 9 §2 a) ». Bloquer la soumission si non cochée. Stocker le consentement dans `Booking.consentArt9Given: bool, consentArt9At: DateTime?`.
3. Pour `UserProfile.organismePaiement` et `mutuelleCode` : ajouter dans `app/profil/page.tsx` une case explicite par champ art. 9 + lien vers politique confidentialité.
4. Désactiver `/api/intent-detect` jusqu'à : (a) ajout d'une notice « votre requête est analysée par Anthropic, États-Unis » et (b) consentement à un transfert hors UE.
5. Définir une finalité claire pour chaque table sensible. Reporter dans la politique confidentialité.

⏱️ **Effort** : **L** (registre + UI consentement art. 9 + migrations DB)

---

### Axe 2 — Information & transparence (art. 12, 13, 14)

**Constats :**
- 🔴 **Aucune page d'information accessible** : pas de `/mentions-legales`, `/politique-confidentialite`, `/cookies`, `/cgu`, `/vie-privee`, `/rgpd` (vérifié par glob exhaustif).
- 🔴 **Footer avec 3 liens morts** (`href="#"`) : Mentions légales, Confidentialité, Accessibilité — `components/docbel/landing/footer.tsx:22-39`.
- 🔴 **Aucun responsable de traitement identifié** : pas de raison sociale, pas de numéro BCE, pas de siège social, pas de nom physique/moral nulle part dans le code (footer affiche juste `© 2026 Docbel`).
- 🔴 **Aucun DPO ni canal vie privée dédié** : grep `DPO|DPD|délégué.*prot|vie-privee@|privacy@|dpo@` → 0 résultat. Seul canal : `contact@docbel.be` non spécifique.
- 🔴 **Aucune mention de l'APD belge** ni du droit de réclamation art. 13.2.d.
- 🔴 **Le setting `rgpd_general`** (`lib/app-settings.ts:42-62`) est le seul contenu RGPD existant — exposé en JSON brut via `/api/settings/public/rgpd` (route consommée nulle part côté front, vérifié par grep). Contenu incomplet : énumère accès/rectification/suppression/portabilité mais **manque opposition, limitation, retrait du consentement, décisions automatisées**, ne mentionne aucun destinataire, aucun transfert hors UE, aucun délai de réponse.
- 🔴 **Le setting affirme à tort « Aucun cookie de pistage tiers »** alors que `@vercel/analytics` est chargé (`app/layout.tsx:3,77`) — déclaration trompeuse au sens APD.
- 🔴 **Aucune information préalable** sur le transfert vers Anthropic US lors de l'utilisation de `/api/intent-detect` ou des outils IA admin.
- 🔴 **Affirmation non documentée** : `app/profil/page.tsx:56-57` indique « Ces informations […] ne sont jamais partagées » — affirmation non étayée par un document juridique opposable (et factuellement fausse puisque le NRN sera transmis aux PDF générés et potentiellement à Doccle/itsme si activés).

📜 **Articles concernés** : RGPD art. 12 (transparence), art. 13 (information lors de collecte directe), art. 14 (collecte indirecte), art. 7 §2 (consentement éclairé).

✅ **Plan de remédiation :**
1. **Créer 3 pages obligatoires via le page-builder** (le template `legal` existe déjà dans `lib/page-builder/page-templates.ts:614-655`) :
   - `/mentions-legales` : raison sociale, BCE, siège, hébergeur (Vercel Inc. + adresse), contact général, contact DPO.
   - `/politique-confidentialite` : reprendre `lib/app-settings.ts:42-62` mais étendu — identité responsable, DPO, finalités par traitement, base légale par traitement, durées de conservation chiffrées, destinataires (liste sous-traitants), **transferts hors UE** (Vercel, Anthropic, OpenAI, Voyage AI, Brave, Resend, Stripe, Google) avec mention DPF + SCC, droits **complets** (accès, rectification, effacement, opposition, limitation, portabilité, retrait, décisions automatisées), droit de réclamation à l'**APD belge** (avec coordonnées : Rue de la Presse 35, 1000 Bruxelles, contact@apd-gba.be), procédure d'exercice (email DPO + formulaire), délai de réponse 1 mois.
   - `/politique-cookies` : voir Axe 7.
2. **Connecter le footer** : `components/docbel/landing/footer.tsx:22-39` remplacer les 3 `href="#"`.
3. **Créer canal dédié** `vie-privee@docbel.be` ou `dpo@docbel.be` (à minima alias mail).
4. **Identifier le responsable de traitement** : choisir l'entité juridique (personne physique solo dev ou SRL/SPRL à créer). Mentionner BCE dans mentions-légales.
5. **Notice contextuelle sur `app/[slug]/rendez-vous/booking-flow.tsx`** avant la soumission : « Vos données seront transmises à [Tenant] dans le cadre de votre demande. Voir [politique de confidentialité](/politique-confidentialite). »
6. **Notice IA sur `components/docbel/onboarding/intent-search.tsx`** : « Votre requête est analysée par un modèle IA hébergé aux États-Unis (Anthropic). »
7. **Corriger l'affirmation `app/profil/page.tsx:56-57`** : remplacer « jamais partagées » par « utilisées exclusivement pour pré-remplir vos formulaires. Pour les détails, voir notre [politique de confidentialité](/politique-confidentialite). »

⏱️ **Effort** : **M** (rédaction politique + page-builder + 1-2 jours)

---

### Axe 3 — Droits des personnes (art. 15-22)

**Constats :**
- 🔴 **Aucun endpoint self-service de droits RGPD** :
  - Pas d'export de données (art. 20 portabilité).
  - Pas de suppression de compte self-service (art. 17 effacement).
  - Pas de mécanisme d'opposition (art. 21).
  - Pas de mécanisme de limitation (art. 18).
- 🔴 **Cascade `onDelete` partielle sur User** — `prisma.user.delete()` à `app/api/users/[id]/route.ts:195` n'efface PAS :
  - `UserProfile` (NISS, IBAN, adresse, employeur) → pas de FK déclarée (`prisma/schema.prisma:1065-1102`).
  - `BundleRun` (payloads JSON complétés contenant NISS/IBAN/adresse) → `userId String?` libre, pas de FK.
  - `Booking` (citizenName/Email/NRN) → `userId String?` libre.
  - `RendezVousHistory` (name nominatif) → pas de FK.
  - `ChatSession/ChatMessage/ChatMemory/KnowledgeSource/GeneratedPrompt` → `createdById String?` libre.
  - `Activity.user String` libre (peut contenir email/nom).
- 🔴 **`Account.accessToken/refreshToken/idToken` Google OAuth stockés en clair** (`prisma/schema.prisma:130-132`) — à révoquer côté Google lors d'une suppression compte.
- 🟠 **Énumération des droits incomplète** dans le setting `rgpd_general` (`lib/app-settings.ts:53`) : manque opposition + limitation + retrait + décisions automatisées.
- 🟢 **Bon point** : Better Auth gère bien la cascade pour `Session`, `Account`, `AdminImpersonationLog` (`prisma/schema.prisma:111, 129, 163, 165`).
- 🟢 **Bon point** : le contrôle d'accès `requireAdminAuth` et les guards tenant (`lib/booking/partner-guard.ts:31-73`) permettent au moins de protéger les données entre utilisateurs.

📜 **Articles concernés** : RGPD art. 15 (accès), art. 16 (rectification), art. 17 (effacement), art. 18 (limitation), art. 20 (portabilité), art. 21 (opposition), art. 22 (décisions automatisées).

✅ **Plan de remédiation :**
1. **Créer `app/profil/donnees-rgpd/page.tsx`** avec 4 actions :
   - **Exporter mes données** → endpoint `app/api/me/export/route.ts` qui agrège `User`, `UserProfile`, `Booking` (userId), `BundleRun`, `RendezVousHistory` du user, retourne un ZIP JSON.
   - **Supprimer mon compte** → endpoint `app/api/me/delete/route.ts` orchestrant la suppression transverse (voir étape 2).
   - **Retirer mes consentements** → toggle par catégorie (newsletter, syndicat, mutuelle, intent-detect).
   - **S'opposer au traitement** → formulaire avec motif, qui crée un `RgpdRequest` en DB pour traitement manuel sous 30 jours.
2. **Ajouter les FK manquantes** dans `prisma/schema.prisma` + migration :
   ```prisma
   model UserProfile {
     userId String @id
     user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
   }
   // Idem BundleRun, Booking (userId nullable mais avec relation SetNull), RendezVousHistory, ChatSession, ChatMessage, ChatMemory, KnowledgeSource, GeneratedPrompt, Activity
   ```
   Attention DB Neon partagée : utiliser `db execute` SQL additif, pas `db push` (cf. MEMORY `project_access_model_vision`).
3. **Endpoint suppression compte** doit aussi :
   - Révoquer le refreshToken Google via API si `Account.providerId='google'`.
   - Logger l'action dans un `RgpdAuditLog`.
   - Envoyer un email de confirmation via Resend.
4. **Page `/contact`** : ajouter sujet « Exercer mes droits RGPD » qui route vers `vie-privee@docbel.be`.
5. **Mettre à jour le texte `lib/app-settings.ts:53`** : énumérer les 7 droits + droit de réclamation APD.

⏱️ **Effort** : **L** (3-5 jours : endpoint export + delete transverse + migration FK + UI)

---

### Axe 4 — Sécurité & intégrité (art. 25, 32)

**Constats positifs :**
- 🟢 **NRN HMAC-SHA256 + AES-256-GCM** pour booking (`lib/booking/dedupe.ts:20-22`, `lib/booking/crypto-nrn.ts:20-26`).
- 🟢 **bcrypt cost 10** pour les mots de passe (`lib/auth.ts:91`).
- 🟢 **Lockout brute-force** : 5 essais / 15 min (`lib/auth.ts:19-20`).
- 🟢 **IP hashées (SHA256)** avant stockage (`app/api/pdf/[slug]/generate/route.ts:187`, bureau-report, form-validation/report).
- 🟢 **Tokens reset password 1h** + magic-link 15 min (`lib/auth.ts:113, 276`).
- 🟢 **Sanitization HTML isomorphe** (`lib/sanitize-html.ts:45-64`) sur tous les 17 `dangerouslySetInnerHTML`.
- 🟢 **Zod systématique** sur 40+ endpoints publics.
- 🟢 **Magic bytes check + SVG scan** sur upload (`app/api/files/upload/route.ts:123-135`).
- 🟢 **CRON_SECRET sur tous les crons** (`lib/booking/notify.ts:28-35`, etc.).
- 🟢 **`trustedOrigins` Better Auth** (`lib/auth.ts:81-84`) — CSRF géré.
- 🟢 **`timingSafeEqual` sur tokens PDF** (`lib/pdf-forms/security.ts:55-74`).

**Constats critiques :**
- 🔴 **Fallback de secret hardcodé** : `lib/booking/crypto-nrn.ts:8-12` et `lib/booking/dedupe.ts:14-18` retombent sur `"docbel-booking-nrn-fallback"` si les vars d'env sont absentes — secret visible dans git public.
- 🔴 **Aucun header de sécurité applicatif** : pas de CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy. `next.config.ts:1-28` n'a pas de `headers()`. `vercel.json` n'a pas de `headers`. Seul un `X-Content-Type-Options: nosniff` au `app/api/files/[id]/download/route.ts:141`.
- 🔴 **Rate-limit en mémoire `Map`** inefficace sur Vercel serverless (`lib/utils/rate-limit.ts:9`, `lib/pdf-forms/security.ts:13-17`) — chaque cold start = nouvelle map. Quasi-inopérant en pratique.
- 🔴 **Aucun rate-limit sur le catch-all Better Auth** (`app/api/auth/[...all]/route.ts:1-5`) → credential stuffing + abus reset/magic-link possibles.
- 🔴 **`citizenNrnEnc` jamais écrit** : `app/api/booking/[slug]/book/route.ts:143-144` alimente uniquement `citizenNrnHash` et `citizenNrnLast4`. La colonne (migration 37) reste NULL → module `crypto-nrn.ts` zombie.
- 🔴 **`citizenNrnEnc` non purgé** : `app/api/cron/booking-purge/route.ts:34-44` anonymise hash + last4 mais oublie `nrnEnc`. Si jamais écrit, NRN reste déchiffrable après 180j.
- 🟠 **Un seul secret `BETTER_AUTH_SECRET` pour 4 usages crypto** : sessions, HMAC NRN, AES NRN, signature tokens PDF. Compromission unique = tout perdu.
- 🟠 **Aucun MFA** pour comptes admin/partner/employer qui accèdent au PII citoyen.
- 🟠 **`UserProfile.niss` stocké en clair** sans hash ni chiffrement (`prisma/schema.prisma:1070`).
- 🟠 **Mot de passe min 8 chars** (`lib/auth.ts:88`) alors que `lib/users.ts:45-55` valide à 10 — pas branché à Better Auth.
- 🟠 **Aucun audit log sur déchiffrement NRN** (`app/api/booking/partner/tenants/[tenantId]/bookings/[bookingId]/nrn/route.ts:17-37`).
- 🟠 **Cron `/api/documents/cron/purge`** référencé dans `vercel.json:4` mais l'endpoint n'existe pas → `BundleRun` (NISS/IBAN complétés) jamais purgés.
- 🟡 **CRLF injection possible** dans le header `From:` du formulaire contact (`app/api/contact-messages/route.ts:50, 113`).
- 🟡 **Session 30 j** pour admin (`lib/auth.ts:202`) — long.
- 🟡 **`OAuth Account` tokens en clair** dans `prisma/schema.prisma:130-132`.
- 🟡 **Mot de passe Neon en clair dans `.env`** (cf. MEMORY `feedback_shared_workdir` — partagé multi-agents).

📜 **Articles concernés** : RGPD art. 25 (privacy by design/default), art. 32 (sécurité du traitement), art. 5.1.f (intégrité et confidentialité).

✅ **Plan de remédiation :**
1. **Bloquer démarrage si secrets absents** :
   ```ts
   // lib/booking/crypto-nrn.ts:8
   const SECRET = process.env.BOOKING_NRN_SECRET ?? process.env.BETTER_AUTH_SECRET;
   if (!SECRET) throw new Error("BOOKING_NRN_SECRET ou BETTER_AUTH_SECRET requis");
   ```
2. **Ajouter `next.config.ts` `headers()`** :
   ```ts
   async headers() {
     return [{
       source: "/(.*)",
       headers: [
         { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
         { key: "X-Content-Type-Options", value: "nosniff" },
         { key: "X-Frame-Options", value: "DENY" },
         { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
         { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self)" },
         { key: "Content-Security-Policy-Report-Only", value: "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; connect-src 'self' https://api.anthropic.com https://api.openai.com https://api.voyageai.com https://api.search.brave.com https://va.vercel-scripts.com" },
       ],
     }];
   }
   ```
3. **Migrer rate-limit vers Upstash** (`@upstash/ratelimit` + `@upstash/redis`) — la variable `RATE_LIMIT_REDIS_URL` semble déjà prévue. Fusionner `lib/utils/rate-limit.ts` et `lib/pdf-forms/security.ts:9-39`.
4. **Ajouter rate-limit Better Auth** : wrapper sur `app/api/auth/[...all]/route.ts` par IP + body.email.
5. **Brancher l'écriture `citizenNrnEnc`** dans `app/api/booking/[slug]/book/route.ts:143-144` via `encryptNrn()` de `lib/booking/crypto-nrn.ts`.
6. **Ajouter null sur `nrnEnc` dans la purge** : `app/api/cron/booking-purge/route.ts:34-44`.
7. **Créer `app/api/documents/cron/purge/route.ts`** pour purger `BundleRun` > 30j.
8. **Découper les secrets** : `BOOKING_NRN_ENC_KEY`, `BOOKING_NRN_HMAC_KEY`, `PDF_FORM_SIGNING_KEY`, `BETTER_AUTH_SECRET` distincts.
9. **Activer MFA Better Auth** pour role=admin obligatoire, partner/employer recommandé.
10. **Créer `NrnAccessLog`** Prisma model + log dans `nrn/route.ts:17-37` chaque déchiffrement.
11. **Aligner mot de passe min à 12 chars** et brancher `validatePassword()` (`lib/users.ts:45-55`) via hook Better Auth.
12. **CRLF refusé** dans `app/api/contact-messages/route.ts:50` : `if (/[\r\n]/.test(name)) return 400`.
13. **Faire pivoter le DB password Neon** (visible dans `.env`) + activer Neon Branch par env.

⏱️ **Effort** : **L** (1-2 semaines pour ensemble, mais les actions 1, 2, 4, 5, 6 sont quick wins en quelques heures)

---

### Axe 5 — Sous-traitants & transferts internationaux (art. 28, 44-49 + Schrems II)

**Constats :**
- 🔴 **Aucun DPA signé documenté dans le repo** (grep négatif sur `DPA|Data Processing Agreement|article 28`). Sous-traitants identifiés sans contrat formel art. 28 :
  - **Vercel Inc.** (US) — hébergement + Blob (PDF générés avec NRN) + Analytics : `app/layout.tsx:3,77`, `lib/storage/blob-storage.ts:1-39`.
  - **Neon (Databricks)** — DB principale (région non confirmée dans `vercel.json`) : `prisma/schema.prisma:4-8`.
  - **Anthropic PBC** (US) — IA chômage + intent + page-builder.
  - **OpenAI L.L.C.** (US) — Whisper voix admin + embeddings fallback.
  - **Voyage AI** (US) — embeddings RAG primaire.
  - **Brave Software** (US) — web search admin.
  - **Resend Inc.** (US) — email transactionnel (envoie nom + email + token de gestion dans liens : `lib/booking/emails.ts:5-87`).
  - **Stripe** (US/IE) — checkout : `app/api/checkout/route.ts:60`.
  - **Google LLC** (US) — OAuth facultatif.
- 🔴 **Aucune information préalable** des utilisateurs sur ces transferts (art. 13 §1 f).
- 🔴 **`@vercel/analytics` chargé sans consentement** (`app/layout.tsx:77`) — transfert US sans base légale.
- 🔴 **OpenAI Whisper sur audio admin** : par défaut 30j rétention OpenAI. Audio peut contenir nom/NRN dicté — risque P0 si admin discute de cas réels.
- 🔴 **Resend dans 9+ chaînes mail** envoie liens magiques + tokens de gestion booking + données nominatives — exposition forte au sous-traitant US (`lib/auth.ts:97-127`, `lib/booking/emails.ts:75-87`, `lib/inbox/send.ts:116-130`).
- 🟠 **Brave Search avec query libre 500 chars** — risque PII admin (`lib/chomage-ia/web-search.ts:51-112`).
- 🟠 **DB Neon partagée multi-env** (cf. MEMORY) — risque de fuite croisée dev/prod, région non explicitée dans `prisma/schema.prisma`.
- 🟠 **Vercel Blob `access: "public"` par défaut** (`lib/storage/blob-storage.ts:17`) — URLs publiques potentiellement devinables sur PDF avec NRN.
- 🟡 **flagcdn.com** charge SVG côté navigateur (IP visiteur exposée à CDN tiers US — `components/docbel/country-flag.tsx:47`).
- 🟡 **unpkg.com** pour PDF.js worker (admin only — `components/admin/pdf-sources/pdf-source-inspector.tsx:59`).
- 🟢 **OVH (FR)** pour IMAP — UE conforme.
- 🟢 **VIES, KBO** — UE/BE.
- 🟢 **OSM/Nominatim** — UK (décision d'adéquation).
- 🟢 **Google Fonts via `next/font/google`** — self-hosted au build, pas de fetch runtime.

📜 **Articles concernés** : RGPD art. 28 (sous-traitant), art. 44-49 (transferts), chapitre V, art. 13.1.f (information sur transferts). Schrems II (CJUE C-311/18). Décisions APD : DPF Adequacy Decision (10 juillet 2023).

✅ **Plan de remédiation :**
1. **Collecter et archiver les DPA** de chaque sous-traitant :
   - Vercel : https://vercel.com/legal/dpa
   - Neon : DPA via support
   - Anthropic : Commercial DPA via account.anthropic.com
   - OpenAI : DPA + activer **Zero Data Retention** sur Whisper (https://openai.com/policies/dpa)
   - Voyage AI : DPA via sales
   - Brave : Business DPA
   - Resend : DPA via support
   - Stripe : DPA via dashboard
   - Google : Workspace DPA
   - OVH : DPA standard
2. **Documenter les sous-traitants dans la politique confidentialité** (cf. Axe 2 — liste complète avec finalité + localisation + DPF/SCC).
3. **Configurer Neon en région UE** : changer le projet vers `eu-central-1` ou similaire. Documenter dans `prisma/schema.prisma:5` ou docs/.
4. **Vercel Blob privé pour PDF avec NRN** : utiliser `access: 'private'` + URLs signées éphémères dans `lib/storage/blob-storage.ts:17` quand le payload contient PII.
5. **Activer ZDR OpenAI Whisper** OU désactiver la feature `CHOMAGE_IA_VOICE_ENABLED` jusqu'à mise en conformité.
6. **Ajouter notice contextuelle** sur `components/docbel/onboarding/intent-search.tsx` avant requête vers Anthropic US.
7. **Considérer une alternative UE** pour les embeddings (Voyage → Mistral Embeddings hébergé UE) si possible techniquement.
8. **Auto-héberger flagcdn** : remplacer `components/docbel/country-flag.tsx:47` par des SVG locaux (`public/flags/*.svg`).
9. **Auto-héberger pdf.js worker** : copier depuis `node_modules/pdfjs-dist/build/pdf.worker.min.js` vers `public/` au lieu de unpkg.

⏱️ **Effort** : **M-L** (collecte DPA = 1-2 jours, refacto Vercel Blob + Neon region = 1-2 jours, ZDR OpenAI = 30 min, notices UI = 1 jour)

---

### Axe 6 — Registre des traitements & AIPD (art. 30, 35)

**Constats :**
- 🔴 **Aucun registre des traitements (art. 30) dans le repo ou docs/**. Pas de fichier `docs/rgpd-registre.md`, pas de Notion référencé, rien.
- 🔴 **Aucune AIPD (analyse d'impact, art. 35) réalisée** — pourtant requise pour beldoc car :
  - **Évaluation systématique** (intent-detect, RAG chômage) — critère §3 a.
  - **Catégories particulières à grande échelle** (NRN, syndicat, mutuelle, données chômage) — critère §3 b.
  - **Croisement de bases** (UserProfile + Booking + BundleRun) — critère §3 c (selon liste APD).
  - **Données vulnérables** (chômeurs, ayants droit CPAS) — critère APD complémentaire.
  - **Solution technologique innovante** (IA Anthropic Haiku) — critère §3 f.
- 🔴 **Aucun PIA documenté** sur intent-detect malgré le transfert hors UE + traitement de requêtes libres potentiellement art. 9.
- 🔴 **Aucun suivi de version des traitements** (création/modification/cessation).
- 🟠 **Activity log existant** (`prisma/schema.prisma:252`) mais granularité user-action, pas registre traitement.
- 🟢 **AdminImpersonationLog** (`prisma/schema.prisma:160`) constitue un excellent registre pour ce traitement spécifique.

📜 **Articles concernés** : RGPD art. 30 (registre des activités de traitement), art. 35 (AIPD), art. 36 (consultation préalable APD si risque résiduel élevé). Liste APD belge des traitements requérant AIPD (https://www.autoriteprotectiondonnees.be/publications/liste-aipd.pdf).

✅ **Plan de remédiation :**
1. **Créer `docs/rgpd/registre-traitements.md`** (fichier interne, pas committé public si BCE non encore actée) listant les 18 traitements identifiés dans la cartographie 2 :
   - Booking citoyen, Inscription partner/employer, Login Better Auth, UserProfile, PDF Forms public, PdfFormDraft, PdfFormPrefill itsme, FormValidationReport, ContactMessage, BureauReport, Newsletter, PageBuilderForm, intent-detect, chomage-ia (admin), PageView beacon, Vercel Analytics, Activity logger, IBAN verify-name.
   - Pour chacun : finalité, base légale, catégories de données, catégories de personnes, destinataires, transferts hors UE + garanties, durée de conservation, mesures techniques.
2. **Conduire une AIPD complète sur 3 traitements P0** :
   - **NRN / Registre national** (UserProfile + Booking) — déclaration au Comité sectoriel SPF Intérieur si pas couvert par AR.
   - **Plateforme Booking** (FGTB/CSC/CGSLB — adhésion syndicale).
   - **chomage-ia + intent-detect** (transferts US + données art. 9).
   Utiliser le template CNIL PIA (https://www.cnil.fr/fr/outil-pia-telechargez-et-installez-le-logiciel-de-la-cnil) — gratuit, accepté par APD belge.
3. **Désigner un DPO formellement** (même si solo dev = vous-même au début, mais documenter la nomination + indépendance + conflit d'intérêts art. 38).
4. **Tenir un journal des incidents/violations** (`docs/rgpd/incidents.md` ou table Prisma `RgpdIncident`).
5. **Si l'AIPD révèle un risque résiduel élevé** → consultation préalable APD belge (procédure art. 36 — délai 8 semaines).

⏱️ **Effort** : **L** (registre + 3 AIPD = 3-5 jours travail concentré)

---

### Axe 7 — Cookies & ePrivacy (loi belge du 13 juin 2005 + APD)

**Constats :**
- 🔴 **Aucune bannière de consentement globale** sur le site. Le seul composant est `components/page-blocks/utility/gdpr-notice.tsx` — c'est un **bloc page-builder optionnel jamais déployé** dans aucun layout.
- 🔴 **Vercel Analytics chargé inconditionnellement** sans gate consentement (`app/layout.tsx:3,77`). Même Vercel Analytics « cookieless » nécessite consentement préalable en BE (pas de dispense audience comme en FR).
- 🔴 **PageViewBeacon non gaté** (`components/page-builder/page-view-beacon.tsx`, monté par `app/[slug]/page.tsx:9`) — envoie `slug`, `referrer`, `device` + IP en rate-limit côté serveur sans consentement préalable.
- 🔴 **Aucune purge des `PageView`** — table `prisma/migrations/30_pagebuilder_page_views/migration.sql` s'accumule indéfiniment.
- 🔴 **Aucune page `/politique-cookies`** + 3 liens footer morts (`href="#"`).
- 🔴 **Déclaration trompeuse** : `lib/app-settings.ts:58-59` affirme « Aucun cookie de pistage tiers » — factuellement faux.
- 🔴 **Aucun mécanisme de retrait** du consentement (RGPD art. 7.3 violé).
- 🟠 **Le bloc `gdpr-notice` lui-même n'est pas conforme** s'il était utilisé : pas de granularité (binaire accept/decline), pas de catégories, `declineText` optionnel donc admin peut publier sans « Refuser », pas de lien vers politique réelle.
- 🟠 **Drafts messagerie en localStorage** (`components/admin/messagerie/email-detail.tsx:125-184`, `components/admin/messagerie/compose-dialog.tsx:41-99`) — données potentiellement sensibles non documentées dans politique admin.
- 🟢 **Cookies fonctionnels conformes** : Better Auth session (`lib/auth.ts:76-208`), cache 5 min, `beldoc-bundle-session` (httpOnly OK contrairement à AUDIT.md obsolète).
- 🟢 **Pas de trackers marketing tiers** (grep négatif sur GA4/gtag/GTM, PostHog, Hotjar, Meta Pixel, etc.).
- 🟢 **Google Fonts auto-hébergées via `next/font/google`** — aucune fuite IP vers Google.

📜 **Articles concernés** : Loi belge du 13 juin 2005 art. 129 §1er (consentement préalable cookies/storage non-strictement nécessaires), RGPD art. 7 (consentement) + art. 7.3 (retrait), Directive ePrivacy 2002/58/CE, décisions APD 19/2021, 81/2023.

✅ **Plan de remédiation :**
1. **Action immédiate** : commenter `<Analytics />` ligne 77 et `<PageViewBeacon />` ligne 9 de `app/[slug]/page.tsx` en attendant le CMP. Ce seul edit élimine le risque P0.
2. **Créer `components/cookie-consent/`** :
   - `consent-provider.tsx` (Context React avec catégories `necessary`, `analytics`).
   - `consent-banner.tsx` (bannière en bas avec boutons **« Tout accepter »** et **« Tout refuser »** au même rang visuel + lien « Personnaliser »).
   - `consent-gate.tsx` (wrapper qui ne rend ses enfants que si la catégorie est consentie).
   - Stockage : cookie `docbel-consent` (`accept/decline/{analytics:bool}`) lisible côté serveur + client.
3. **Monter le provider dans `app/layout.tsx`** au-dessus de `<Analytics />`. Envelopper :
   ```tsx
   <ConsentGate category="analytics">
     <Analytics />
   </ConsentGate>
   ```
4. **Gater `PageViewBeacon`** dans `app/[slug]/page.tsx:9` (ou côté composant via hook `useConsent`).
5. **Créer `app/politique-cookies/page.tsx`** avec inventaire réel (tableau extrait de la cartographie 6).
6. **Connecter footer** : `components/docbel/landing/footer.tsx:22-39` → liens vers `/mentions-legales`, `/politique-confidentialite`, `/politique-cookies`. Ajouter un lien **« Gérer mes cookies »** qui rouvre la bannière (`document.cookie.delete('docbel-consent')` + reload).
7. **Cron purge `PageView` > 13 mois** : créer `app/api/cron/page-views-purge/route.ts` + cron `vercel.json`.
8. **Anonymiser le referrer** dans `app/api/page-views/route.ts:29-30` : retirer la query string avant insertion.
9. **Corriger `lib/app-settings.ts:58-59`** : décrire réellement Vercel Analytics + PageView beacon.
10. **Si on conserve le bloc `gdpr-notice`** : rendre `declineText` obligatoire dans `components/page-blocks/utility/schemas.ts`.
11. **Politique admin** : ajouter section « Drafts messagerie » + bouton « Vider tous les brouillons » dans `components/admin/messagerie/`.

⏱️ **Effort** : **M** (CMP custom 2-3 jours, ou intégration Klaro/Cookiebot 1 jour)

---

### Axe 8 — NRN belge (loi du 8 août 1983 sur le registre national)

**Cadre légal :** Loi du 8 août 1983 + AR exécution. **Toute utilisation du NRN par une personne morale ou physique privée doit être autorisée par le Comité sectoriel du Registre national** (SPF Intérieur) sauf dérogation expresse. Le NRN n'est pas un identifiant ordinaire — il a un statut juridique propre, indépendant du RGPD.

**Constats :**
- 🔴 **`UserProfile.niss` en clair** sans hash ni chiffrement (`prisma/schema.prisma:1070`) — saisi via `app/api/user/profile/route.ts:38-39` avec seulement `isValidNISS(body.niss)`.
- 🔴 **Aucune autorisation Comité sectoriel SPF Intérieur** documentée dans le repo. Aucun acte de désignation, pas de finalité justifiée auprès du SPF.
- 🔴 **Fallback secret `"docbel-booking-nrn-fallback"` hardcodé** dans `lib/booking/crypto-nrn.ts:8-12` et `lib/booking/dedupe.ts:14-18` — si `BOOKING_NRN_SECRET` absent en prod, HMAC et AES utilisent un secret connu publiquement.
- 🔴 **`citizenNrnEnc` jamais alimenté** dans `app/api/booking/[slug]/book/route.ts:143-144` — code zombie. Soit on l'utilise, soit on le retire.
- 🔴 **`citizenNrnEnc` non purgé** par `app/api/cron/booking-purge/route.ts:34-44` — NRN reste déchiffrable après 180j (si jamais écrit).
- 🔴 **PDF Forms type `niss`** stocke le NRN en clair dans `PdfFormDraft.payload` (`prisma/schema.prisma:1815`) avec TTL 7 jours — pas de chiffrement.
- 🔴 **BundleRun.payloads** contient NRN complétés en clair, jamais purgés (cron `/api/documents/cron/purge` référencé dans `vercel.json:4` mais endpoint inexistant).
- 🔴 **Aucun audit log** sur la consultation NRN (déchiffrement par agent) — `app/api/booking/partner/tenants/[tenantId]/bookings/[bookingId]/nrn/route.ts:17-37` ne trace pas l'accès.
- 🟠 **Aucun mécanisme de rotation de la clé NRN** — HMAC déterministe doit conserver la même clé à vie pour le dedupe.
- 🟠 **HMAC indexé** (`tenantId, citizenNrnHash`) — exposable via timing attacks si agent forge des requêtes.
- 🟢 **Bon point** : validation algorithmique mod-97 (`lib/booking/form-fields.ts:31-39`).
- 🟢 **Bon point** : approche triple représentation côté Booking (HMAC + Last4 + AES) techniquement correcte (`lib/booking/dedupe.ts`, `lib/booking/crypto-nrn.ts`).
- 🟢 **Bon point** : `redactSensitiveFormData()` retire le NRN du `formData` JSON avant persistance (`lib/booking/form-fields.ts:155-168`).
- 🟢 **Bon point** : déchiffrement protégé par `guardTenant('approve')` (`nrn/route.ts:22`).

📜 **Articles concernés** : Loi du 8 août 1983 art. 5 (autorisation Comité sectoriel), art. 8 (sanctions pénales 100€-20 000€ par infraction). RGPD art. 87 (identifiants nationaux — la BE a transposé via la loi 30 juillet 2018 art. 8 qui renvoie à la loi 1983). Cas APD : déclaration de violation Mensura 2020.

✅ **Plan de remédiation :**
1. **Déposer une demande d'autorisation au Comité sectoriel du Registre national** (SPF Intérieur) — formulaire dispo sur https://ibz.rrn.fgov.be. Justification beldoc : « pré-remplissage de formulaires officiels pour le compte de la personne concernée » (probablement éligible à dérogation art. 5 §1 si traité comme mandataire). Délai usuel : 2-4 mois. **C'est la pièce manquante la plus structurante.**
2. **Migrer `UserProfile.niss` vers chiffré** :
   ```prisma
   nissEnc String? // AES-256-GCM
   nissHash String? @unique // HMAC pour lookup
   nissLast4 String? // affichage
   ```
   Migration SQL additive (Neon partagée, pas de `db push`). Reprendre l'approche `lib/booking/crypto-nrn.ts`.
3. **Supprimer le fallback hardcodé** dans `lib/booking/crypto-nrn.ts:8-12` et `lib/booking/dedupe.ts:14-18` :
   ```ts
   const SECRET = process.env.BOOKING_NRN_SECRET;
   if (!SECRET) throw new Error("BOOKING_NRN_SECRET requis (NRN belge — loi 8 août 1983)");
   ```
4. **Alimenter `citizenNrnEnc`** dans `app/api/booking/[slug]/book/route.ts:143-144` via `encryptNrn(rawNrn)`.
5. **Purger `citizenNrnEnc`** dans `app/api/cron/booking-purge/route.ts:34-44` (ajouter `nrnEnc: null`).
6. **Créer `NrnAccessLog` Prisma + logger** chaque déchiffrement dans `app/api/booking/partner/tenants/[tenantId]/bookings/[bookingId]/nrn/route.ts:17-37`. Format : `{ accessorId, accessorRole, bookingId, tenantId, ipAddress, at }`.
7. **Chiffrer `PdfFormDraft.payload`** quand il contient un champ type `niss` (cf. `lib/pdf-forms/types.ts:67`).
8. **Créer le cron `/api/documents/cron/purge`** manquant pour `BundleRun`.
9. **Préfixer le payload chiffré avec un versioning de clé** (`v1:base64...`) pour permettre rotation future sans casser l'historique.
10. **Documenter dans `/politique-confidentialite`** : « Le NRN/NISS est traité conformément à la loi du 8 août 1983, sous autorisation Comité sectoriel n°XXX, chiffré au repos, et accessible uniquement aux agents autorisés. »

⏱️ **Effort** : **L** (démarche SPF = administratif long délai, mais technique 2-3 jours)

---

### Axe 9 — Données sensibles art. 9 (chômage, syndicat FGTB/CSC, santé)

**Constats :**
- 🔴 **Adhésion syndicale** déduite automatiquement de plusieurs sources, sans consentement explicite art. 9 §2 a :
  - Booking chez tenant FGTB/CSC/CGSLB (`lib/booking/status.ts`, `app/[slug]/rendez-vous/booking-flow.tsx`).
  - `UserProfile.organismePaiement ∈ {fgtb, csc, cgslb, capac}` en clair (`prisma/schema.prisma:1096`).
  - `Booking.tenantId` lié à un tenant syndical révèle l'adhésion par déduction.
- 🔴 **Adhésion mutualiste** : `UserProfile.mutuelleCode ∈ {solidaris, mc, mloz, mutlibres, neutrales}` en clair (`prisma/schema.prisma:1098`). Solidaris/MC historiquement marquées politiquement.
- 🔴 **Données de santé potentiellement collectées** sans protection art. 9 dans :
  - `motive` textarea du booking (`app/[slug]/rendez-vous/booking-flow.tsx`).
  - Message libre du formulaire de contact (`app/api/contact-messages/route.ts`).
  - Requête libre `/api/intent-detect` envoyée à Anthropic US.
  - Bundles « Maladie / Incapacité » (à vérifier).
- 🔴 **Statut civil** `UserProfile.maritalStatus ∈ {single, married, cohabiting, divorced, widowed}` — pas art. 9 strict mais sensible (RGPD considère que peut révéler religion via cohabiting/married selon religion).
- 🔴 **Genre** `UserProfile.gender` — peut révéler identité de genre (art. 9 selon doctrine APD).
- 🔴 **Aucun chiffrement** sur ces colonnes art. 9 (`UserProfile` 1065-1102, tout en clair).
- 🔴 **Pas de cascade `onDelete`** pour `UserProfile` (cf. Axe 3) — donc effacement impossible.
- 🔴 **Pas de mécanisme de retrait** du consentement art. 9.
- 🟢 **Bon point partiel** : `redactSensitiveFormData()` (`lib/booking/form-fields.ts:155-168`) protège le NRN dans `Booking.formData`. À étendre pour `motive` si on veut filtrer santé.

📜 **Articles concernés** : RGPD art. 9 §1 (interdiction de principe) + §2 a (consentement explicite — la seule exception applicable à beldoc en l'absence de relation contractuelle d'emploi ou de fournisseur santé). Loi 30 juillet 2018 art. 8-10 (dispositions belges art. 9). Décision APD 116/2022 (catégorie particulière + grande échelle).

✅ **Plan de remédiation :**
1. **Implémenter un consentement explicite et granulaire par catégorie art. 9** sur `app/profil/page.tsx` :
   ```tsx
   <Checkbox required>
     Je consens explicitement à ce que beldoc traite mon organisme de paiement chômage
     (donnée révélant mon adhésion à un syndicat, art. 9 RGPD)
     pour les finalités décrites dans la politique de confidentialité.
   </Checkbox>
   ```
   Idem pour `mutuelleCode`, `gender`, `maritalStatus`.
2. **Stocker le consentement** dans une table dédiée :
   ```prisma
   model Art9Consent {
     id String @id @default(cuid())
     userId String
     user User @relation(fields: [userId], references: [id], onDelete: Cascade)
     category String // "syndicat" | "mutuelle" | "genre" | "etatcivil" | "sante"
     givenAt DateTime @default(now())
     withdrawnAt DateTime?
     ipAddress String?
     consentText String // archive du texte affiché à l'utilisateur
   }
   ```
3. **Pour Booking syndical** : ajouter dans `app/[slug]/rendez-vous/booking-flow.tsx` une étape avec case obligatoire :
   ```
   « Je consens à ce que ma demande soit transmise à [FGTB|CSC|CGSLB] et que beldoc
   stocke mes données pour cette demande (RGPD art. 9 §2 a). »
   ```
   Bloquer la soumission si non cochée.
4. **Chiffrer au repos** les colonnes art. 9 critiques (`organismePaiement`, `mutuelleCode`) via une approche similaire à `crypto-nrn.ts` — ou au minimum hash pour `organismePaiement` (lookup par hash dans pré-remplissage formulaires).
5. **Pour `motive` booking et message libre contact** : ajouter un warning UI « N'incluez pas d'informations médicales ou de données sensibles dans ce champ — utilisez la rubrique générique. »
6. **Pour `/api/intent-detect`** : ajouter notice « Votre requête sera analysée par un modèle IA (Anthropic, États-Unis). Ne saisissez pas de données personnelles sensibles. » + consentement.
7. **Cascade `onDelete` sur tous les User.id liés à art. 9** (cf. Axe 3).
8. **Documenter art. 9 dans la politique confidentialité** : section dédiée listant chaque catégorie, base légale (§2 a), exception invoquée, durée, droits.

⏱️ **Effort** : **L** (UI consentement + table + migration + chiffrement = 4-6 jours)

---

### Axe 10 — Notification de violation (art. 33-34)

**Constats :**
- 🔴 **Aucune procédure documentée de notification de violation** : ni dans `docs/`, ni dans `README.md`, ni dans `CLAUDE.md`. Aucun fichier `incident-response.md` ou similaire.
- 🔴 **Aucun template de notification à l'APD** (72h) ou aux personnes concernées.
- 🔴 **Aucun monitoring de sécurité actif** :
  - Pas de Sentry/PostHog/Datadog branché (grep négatif).
  - `console.error` brut sur ~73 endpoints sans agrégation.
  - Pas d'alerte sur lockout brute-force (`lib/auth.ts:19-20`).
  - Pas d'alerte sur erreurs Prisma multiples.
- 🔴 **Aucun journal de violation interne** (table `RgpdIncident` ou fichier).
- 🟠 **Lockout brute-force génère des `User.failedLoginAttempts`** (`prisma/schema.prisma:67-68`) — utile mais sans alerting personne ne le voit.
- 🟢 **AdminImpersonationLog** opérationnel (`prisma/schema.prisma:160`) — bon traçage en cas d'abus interne.
- 🟢 **Better Auth `banReason` et `status='disabled'`** disponibles (`prisma/schema.prisma`) — leviers de réponse à incident.

📜 **Articles concernés** : RGPD art. 33 (notification APD sous 72h), art. 34 (notification personnes concernées si risque élevé), art. 32 §1 b (capacité à rétablir la disponibilité).

✅ **Plan de remédiation :**
1. **Créer `docs/rgpd/procedure-violation.md`** documentant :
   - Définition d'une violation (confidentialité / intégrité / disponibilité).
   - Chaîne d'escalade (qui détecte → DPO → décision notification → APD).
   - **Template de notification APD** (https://www.autoriteprotectiondonnees.be/notifier-une-fuite-de-donnees) à remplir en 72h.
   - **Template d'information aux personnes concernées** (langage clair, droits, mesures).
   - Délais : 72h APD, sans délai pour personnes si risque élevé.
2. **Créer table `RgpdIncident`** Prisma :
   ```prisma
   model RgpdIncident {
     id String @id @default(cuid())
     detectedAt DateTime @default(now())
     description String
     dataCategories String[]
     personsAffected Int?
     severity String // "low" | "medium" | "high" | "critical"
     notifiedApd Boolean @default(false)
     notifiedApdAt DateTime?
     notifiedPersons Boolean @default(false)
     resolution String?
     resolvedAt DateTime?
     handledBy String? // userId
   }
   ```
3. **Brancher un monitoring d'erreurs** (Sentry SaaS UE ou alternative auto-hébergée GlitchTip) — attention DPA Sentry signé + EU data residency.
4. **Alertes automatiques** :
   - Cron quotidien qui check `User.failedLoginAttempts > 50` sur 24h → email admin.
   - Cron qui check erreurs Prisma anormales.
   - Cron sur `AdminImpersonationLog` créés > X/jour.
5. **Tester un incident factice** une fois par an (table-top exercise documenté).
6. **Préparer la communication** : page `/securite` qui sera utilisée en cas de notification massive.

⏱️ **Effort** : **M** (docs + 1 migration + 1-2 crons = 1-2 jours)

---

## 📋 Checklist conformité

- [ ] Désactiver `<Analytics />` et `<PageViewBeacon />` immédiatement — Axe 7 — **P1**
- [ ] Bloquer démarrage si `BOOKING_NRN_SECRET` absent — Axe 4/8 — **P1**
- [ ] Alimenter `citizenNrnEnc` dans book/route.ts — Axe 8 — **P1**
- [ ] Purger `citizenNrnEnc` dans booking-purge — Axe 8 — **P1**
- [ ] Corriger `lib/app-settings.ts:58-59` (« Aucun cookie de pistage » faux) — Axe 7 — **P1**
- [ ] Créer page `/mentions-legales` (responsable + BCE + DPO) — Axe 2 — **P1**
- [ ] Créer page `/politique-confidentialite` complète art. 13 — Axe 2 — **P1**
- [ ] Créer page `/politique-cookies` avec inventaire réel — Axe 7 — **P1**
- [ ] Connecter les 3 liens morts du footer — Axe 2/7 — **P1**
- [ ] Créer `vie-privee@docbel.be` ou alias — Axe 2 — **P1**
- [ ] Identifier raison sociale + BCE du responsable de traitement — Axe 2 — **P1**
- [ ] Ajouter `next.config.ts` `headers()` (CSP report-only + HSTS + XFO + Referrer-Policy + Permissions-Policy) — Axe 4 — **P1**
- [ ] Implémenter bannière de consentement avec 2 catégories minimum + lien « Gérer mes cookies » — Axe 7 — **P1**
- [ ] Ajouter case consentement art. 9 sur booking FGTB/CSC/CGSLB — Axe 1/9 — **P1**
- [ ] Désactiver `/api/intent-detect` OU ajouter notice transfert Anthropic US + consentement — Axe 1/5 — **P1**
- [ ] Collecter et archiver DPA pour Vercel, Neon, Anthropic, OpenAI, Voyage, Brave, Resend, Stripe, Google, OVH — Axe 5 — **P1**
- [ ] Faire pivoter le password Neon (visible dans `.env` partagé) — Axe 4 — **P1**
- [ ] Configurer Neon en région UE — Axe 5 — **P2**
- [ ] Migrer rate-limit vers Upstash KV — Axe 4 — **P2**
- [ ] Ajouter rate-limit sur `app/api/auth/[...all]/route.ts` — Axe 4 — **P2**
- [ ] Activer ZDR OpenAI Whisper OU désactiver feature voix — Axe 5 — **P2**
- [ ] Créer endpoint `/api/me/export` (portabilité art. 20) — Axe 3 — **P2**
- [ ] Créer endpoint `/api/me/delete` (effacement art. 17 transverse) — Axe 3 — **P2**
- [ ] Ajouter FK Cascade User sur UserProfile + chaînes liées — Axe 3 — **P2**
- [ ] Créer `NrnAccessLog` Prisma + log dans nrn/route.ts — Axe 4/8 — **P2**
- [ ] Créer cron manquant `/api/documents/cron/purge` pour BundleRun — Axe 4 — **P2**
- [ ] Cron purge `PageView` > 13 mois — Axe 7 — **P2**
- [ ] Anonymiser referrer dans api/page-views — Axe 7 — **P2**
- [ ] Rédiger registre des traitements art. 30 (`docs/rgpd/registre-traitements.md`) — Axe 6 — **P2**
- [ ] Conduire AIPD sur NRN, Booking syndical, chomage-ia (template CNIL PIA) — Axe 6 — **P2**
- [ ] Désigner DPO formellement (acte interne) — Axe 6 — **P2**
- [ ] Déposer demande Comité sectoriel SPF Intérieur pour NRN — Axe 8 — **P2**
- [ ] Documenter procédure violation (`docs/rgpd/procedure-violation.md`) + créer `RgpdIncident` Prisma — Axe 10 — **P2**
- [ ] Activer MFA Better Auth pour admin obligatoire — Axe 4 — **P3**
- [ ] Découper secrets crypto (BOOKING_NRN_ENC_KEY / HMAC_KEY / PDF_FORM_SIGNING_KEY) — Axe 4 — **P3**
- [ ] Chiffrer `UserProfile.niss` (migration vers nissEnc/Hash/Last4) — Axe 8 — **P3**
- [ ] Auto-héberger flagcdn.com SVG + pdf.js worker — Axe 5 — **P3**
- [ ] Brancher Sentry UE-residency avec DPA — Axe 10 — **P3**

---

## 📞 Quand consulter un avocat IT/DPO externe

Tâches qui dépassent le DIY solo dev — ne pas hésiter à externaliser :

1. **Choix de la forme juridique du responsable de traitement** — solo dev personne physique vs SRL/société. Implications fiscales + RGPD + responsabilité.
2. **Rédaction finale des CGU + politique de confidentialité** opposables juridiquement (le brouillon que vous écrirez à partir de ce rapport doit être relu par un juriste IT belge, ~600-1500€).
3. **Négociation DPA Anthropic Commercial** — clauses spécifiques sur PII européen + non-utilisation pour entraînement. Si beldoc atteint un volume significatif, demander un addendum custom.
4. **Demande d'autorisation au Comité sectoriel SPF Intérieur** pour le NRN — formulaire complexe, justification finalité doit tenir juridiquement (loi 8 août 1983 art. 5). Erreur ici = rejet + remise du dossier dans 6 mois.
5. **AIPD formelle art. 35** sur la plateforme Booking syndicale + chomage-ia — un juriste IT peut valider que vos critères de risque résiduel acceptable sont défendables devant l'APD. ~2000-4000€ par AIPD complète.
6. **Notification de violation à l'APD** (art. 33, 72h) — si un incident survient, ne pas notifier seul : tournure rédactionnelle critique. Avoir un avocat IT en short-list.
7. **Consultation préalable APD art. 36** — si une AIPD révèle un risque résiduel élevé non mitigé. Délai 8 semaines, démarche formelle.
8. **Réponse à un courrier APD** (demande d'information, mise en demeure, contrôle sur place). À ne jamais répondre seul — délai de réponse 30 jours en général.
9. **Conflit avec sous-traitant** sur un incident impliquant ses systèmes (ex. fuite Vercel) — répartition de responsabilité art. 82 §4.
10. **Demande complexe d'exercice de droits** par un utilisateur (notamment opposition motivée art. 21 §2 ou demande de portabilité couvrant des données extraites). À traiter au cas par cas.

**Conseil pratique solo dev** : prendre un retainer 4-8h/an chez un cabinet IT belge (ex. Sirius Legal, Linklaters, Spinosa Dossogne, Crosslaw, DLA Piper) au tarif horaire 250-400€. Total 1000-3000€/an pour avoir un référent juridique disponible.

---

## 📚 Ressources officielles

**Autorités**
- **APD belge (Autorité de protection des données / GBA)** : https://www.autoriteprotectiondonnees.be — formulaire notification fuite : https://www.autoriteprotectiondonnees.be/notifier-une-fuite-de-donnees — liste AIPD obligatoire : https://www.autoriteprotectiondonnees.be/publications/liste-aipd.pdf
- **CNIL (France)** — référence pratique reconnue par APD : https://www.cnil.fr — outil PIA gratuit : https://www.cnil.fr/fr/outil-pia
- **EDPB / CEPD (Comité européen)** — lignes directrices RGPD : https://edpb.europa.eu/our-work-tools/our-documents/our-documents_fr
- **SPF Intérieur — Comité sectoriel du Registre national** : https://ibz.rrn.fgov.be (demandes d'autorisation NRN)

**Textes légaux**
- **Loi belge du 30 juillet 2018** relative à la protection des personnes physiques à l'égard des traitements de données à caractère personnel — https://www.ejustice.just.fgov.be/cgi/article.pl?language=fr&lg_txt=F&numac=2018040581
- **Loi du 8 août 1983** sur le registre national — https://www.ejustice.just.fgov.be/cgi_loi/loi_a1.pl?language=fr&caller=list&cn=1983080837
- **Loi du 13 juin 2005** relative aux communications électroniques (art. 129 ePrivacy belge) — https://www.ejustice.just.fgov.be/cgi_loi/loi_a1.pl?language=fr&caller=list&cn=2005061332
- **RGPD (UE 2016/679)** — https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679
- **Directive ePrivacy 2002/58/CE** — https://eur-lex.europa.eu/legal-content/FR/ALL/?uri=CELEX:32002L0058

**Décisions APD utiles à citer/étudier**
- **APD Belgique 19/2021** — cookies sans consentement (50 000 €)
- **APD Belgique 81/2023** — cookies + bannière non conforme (300 000 €)
- **APD Belgique 116/2022** — catégorie particulière + grande échelle
- **CJUE C-311/18 (Schrems II)** — transferts US (juillet 2020)

**Outils pratiques**
- **Template registre des traitements** : https://www.autoriteprotectiondonnees.be/publications/registre-modele.docx
- **Outil PIA CNIL** (gratuit, accepté APD BE) : https://www.cnil.fr/fr/outil-pia-telechargez-et-installez-le-logiciel-de-la-cnil
- **HSTS preload submission** : https://hstspreload.org
- **DPA Vercel** : https://vercel.com/legal/dpa
- **DPA Anthropic Commercial** : https://www.anthropic.com/legal/commercial-dpa
- **OpenAI Zero Data Retention** : https://platform.openai.com/docs/guides/your-data