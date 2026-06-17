# Docbel Formations — Guide de configuration (ce que l'humain complète plus tard)

> Le module Formations tourne **entièrement** avec des providers mock / manuel /
> local : **aucune variable d'environnement n'est requise** pour qu'il fonctionne.
> Ce guide décrit ce qui est optionnel et ce qu'il faut faire pour passer chaque
> brique en production.
>
> **TL;DR — si rien n'est configuré :** catalogue, Boussole, inscriptions,
> attestations (PDF à la demande) et notifications in-app fonctionnent ; les emails
> ne sont pas envoyés (seulement journalisés), les paiements sont en suivi manuel,
> et l'IA d'orientation reste déterministe (locale).

## Variables d'environnement

| Variable | Domaine | Rôle | Comportement si **non définie** |
| -------- | ------- | ---- | ------------------------------- |
| `TRAINING_PAYMENT_PROVIDER` | Paiement | Sélectionne le provider : `manual` \| `mock` \| `stripe` \| `paypal` \| `disabled` | Défaut **`manual`** (suivi par l'organisme ; Docbel ne traite pas le paiement). |
| `TRAINING_AI_PROVIDER` | IA orientation | Sélectionne le provider IA : `local-rules` \| `mock` \| `openai` \| `anthropic` \| `disabled` | Défaut **`local-rules`** (explication déterministe, sans appel externe). |
| `ORIENTATION_AI_PROVIDER` | IA orientation | Alias de repli lu si `TRAINING_AI_PROVIDER` est absent | Idem → **`local-rules`**. |
| `TRAINING_EMAIL_PROVIDER` | Email | Sélecteur de provider email (réservé ; l'envoi réel dépend de Resend) | Non requis ; l'envoi est piloté par la présence de `RESEND_API_KEY`. |
| `RESEND_API_KEY` | Email | Clé API Resend pour l'envoi réel des emails transactionnels | **Pas d'email envoyé** : les notifications sont uniquement **journalisées in-app** (provider `database`). |
| `EMAIL_FROM` | Email | Expéditeur des emails (ex. `DocBel <noreply@docbel.be>`) | Défaut **`DocBel <noreply@docbel.be>`**. |
| `BLOB_READ_WRITE_TOKEN` | Stockage | Jeton Vercel Blob pour stocker les PDF de certificats | **Pas de stockage** : les PDF de certificats sont **générés à la demande** (non persistés ; `pdfUrl` reste nul). |
| `STRIPE_SECRET_KEY` | Paiement (V4) | Clé secrète Stripe | Placeholder V4 — non câblé ; retombe sur le suivi manuel. |
| `STRIPE_WEBHOOK_SECRET` | Paiement (V4) | Secret de validation des webhooks Stripe | Placeholder V4 — webhook non câblé. |
| `PAYPAL_CLIENT_ID` | Paiement (V4) | Identifiant client PayPal | Placeholder V4 — non câblé ; retombe sur le suivi manuel. |
| `PAYPAL_CLIENT_SECRET` | Paiement (V4) | Secret client PayPal | Placeholder V4 — non câblé. |
| `OPENAI_API_KEY` | IA (placeholder) | Clé OpenAI pour une IA d'orientation réelle | Placeholder — la branche `openai` retombe sur `local-rules`. |
| `ANTHROPIC_API_KEY` | IA (placeholder) | Clé Anthropic pour une IA d'orientation réelle | Placeholder — la branche `anthropic` retombe sur `local-rules`. |
| `DOCBEL_COMMISSION_RATE` | Paiement (V4) | Taux de commission Docbel sur les ventes (marketplace) | Non utilisé tant que le paiement réel n'est pas implémenté. |
| `S3_*` (ex. `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) | Stockage (alt) | Stockage S3 alternatif | **Non câblé** — réservé pour un futur adaptateur de stockage. |
| `CLOUDFLARE_R2_*` | Stockage (alt) | Stockage Cloudflare R2 alternatif | **Non câblé** — réservé pour un futur adaptateur de stockage. |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | URL app | Base d'URL pour les liens (emails, vérification de certificat) | Repli sur `BETTER_AUTH_URL`, puis **`https://docbel.be`**. |
| `BETTER_AUTH_URL` | URL app | Base d'URL de repli | Repli final **`https://docbel.be`**. |

> Les variables marquées « V4 / placeholder / alt » n'ont **aucun effet** tant que
> le code correspondant n'est pas implémenté (voir « Points d'intervention humaine »).

## Providers disponibles

| Domaine | Options | Fichier de sélection / implémentation |
| ------- | ------- | ------------------------------------- |
| **Email / notifications** | `resend` (si `RESEND_API_KEY`) sinon `database` (log in-app) | `lib/formations/providers/notifications.ts` (sélection `emailProviderName()` + journal `TrainingNotificationLog`) ; envoi : `lib/formations/emails.ts` |
| **Paiement** | `manual` (défaut) · `mock` · `disabled` · `stripe` / `paypal` (placeholders) | `lib/formations/providers/payment.ts` (`getPaymentProvider()`, `createPayment()`, `handlePaymentWebhook()`) |
| **IA orientation** | `local-rules` (défaut) · `mock` · `disabled` · `openai` / `anthropic` (placeholders) | `lib/formations/providers/ai.ts` (`getOrientationAIProvider()`, `explainOrientationResult()`) |
| **Stockage** | Vercel Blob (si `BLOB_READ_WRITE_TOKEN`) sinon génération à la demande | `lib/storage/blob-storage.ts` (`isBlobsEnabled()`, `saveBlob()`, `getBlob()`) ; fallback : `lib/formations/certificates/service.ts` (`buildPdfForCertificate()`) |
| **PDF** | `jsPDF` (import dynamique, aucune dépendance externe) | `lib/formations/certificates/pdf.ts` (`buildCertificatePdf()`) |
| **QR** | _aucun_ (différé V3) | — (à ajouter dans `lib/formations/certificates/pdf.ts`) |

## Passer de mock/manual à production

### Email (Resend)

1. Créer un compte Resend, vérifier le domaine d'envoi.
2. Définir `RESEND_API_KEY=...` (et, recommandé, `EMAIL_FROM="DocBel <noreply@votre-domaine>"`).
3. Aucune autre modif : `lib/formations/providers/notifications.ts` détecte la clé
   (`emailProviderName()` → `resend`) et envoie via `sendEnrollmentEmail`
   (`lib/formations/emails.ts`). Chaque envoi est journalisé dans
   `TrainingNotificationLog` (`channel: email`, `status: sent|failed`).

### Stockage des certificats (Vercel Blob)

1. Activer Vercel Blob sur le projet et récupérer le jeton.
2. Définir `BLOB_READ_WRITE_TOKEN=...`.
3. `isBlobsEnabled()` (`lib/storage/blob-storage.ts`) passe à `true`. Brancher le
   stockage du PDF émis (renseigner `TrainingCertificate.pdfUrl` via `saveBlob()`)
   à l'émission ou au premier téléchargement. Sans jeton, le PDF reste généré à la
   demande par `buildPdfForCertificate()` (rien à faire).

### Paiement (V4 — Stripe / PayPal)

1. Implémenter la branche `stripe` (et/ou `paypal`) dans `createPayment()` de
   `lib/formations/providers/payment.ts` (création d'une session de paiement +
   `redirectUrl`), en remplaçant le retour « placeholder → manual » actuel.
2. Implémenter `handlePaymentWebhook()` et créer la **route webhook**
   (ex. `app/api/formations/payment/webhook/route.ts`) qui valide la signature et
   confirme l'inscription.
3. Définir `TRAINING_PAYMENT_PROVIDER=stripe` (ou `paypal`) + les clés
   (`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, ou `PAYPAL_CLIENT_ID` /
   `PAYPAL_CLIENT_SECRET`) et activer le flag `payments`.
4. Optionnel : `DOCBEL_COMMISSION_RATE` pour la commission marketplace.

### IA d'orientation (V4 — OpenAI / Anthropic)

1. Implémenter la branche `openai` ou `anthropic` dans `explainOrientationResult()`
   de `lib/formations/providers/ai.ts` (remplacer le fallback `local-rules` actuel
   par un vrai appel), en **conservant le disclaimer** (l'IA ne prescrit jamais de
   métier).
2. Définir `TRAINING_AI_PROVIDER=openai` (ou `anthropic`) + `OPENAI_API_KEY` /
   `ANTHROPIC_API_KEY`, et activer le flag `ai`.
3. Garder `local-rules` comme repli en cas d'erreur/d'absence de clé.

### QR code sur les certificats (V3)

1. Ajouter une dépendance QR (ex. `qrcode`).
2. Dans `buildCertificatePdf()` (`lib/formations/certificates/pdf.ts`), générer
   l'image QR à partir de `data.verifyUrl` et l'insérer dans le PDF (à côté du code
   de vérification déjà affiché).

## Points d'intervention humaine (checklist des stubs/TODO)

- [ ] **Paiement réel** — `lib/formations/providers/payment.ts` : branches
      `stripe` / `paypal` de `createPayment()` retournent un placeholder « manual » ;
      `handlePaymentWebhook()` renvoie `{ handled: false }`. → implémenter + route
      webhook + clés + flag `payments`.
- [ ] **IA réelle** — `lib/formations/providers/ai.ts` : `explainOrientationResult()`
      force `local-rules` pour `openai` / `anthropic`. → implémenter l'appel réel +
      clés + flag `ai` (conserver le disclaimer).
- [ ] **Stockage des PDF** — `lib/formations/certificates/service.ts` : le PDF est
      généré à la demande, `TrainingCertificate.pdfUrl` reste nul. → persister via
      `saveBlob()` une fois `BLOB_READ_WRITE_TOKEN` défini.
- [ ] **QR de vérification** — `lib/formations/certificates/pdf.ts` : pas de QR. →
      ajouter la lib `qrcode` et le rendu.
- [ ] **Email** — `RESEND_API_KEY` non défini → aucun envoi (log in-app seulement).
      → définir la clé pour activer l'envoi.
- [ ] **Stockage alternatif (S3 / R2)** — variables `S3_*` / `CLOUDFLARE_R2_*` non
      câblées. → écrire un adaptateur si Vercel Blob n'est pas retenu.
- [ ] **Marketplace / commission** — `DOCBEL_COMMISSION_RATE` non utilisé. → câbler
      lors de l'implémentation du paiement réel + flag `marketplace`.
- [ ] **Feature flags V3/V4** — `lms`, `quizzes`, `paths`, `marketplace`,
      `partnerApi`, `qualityScore`, `docbelCertified`, `sponsored` sont **OFF** par
      défaut. → activer au fur et à mesure que chaque fonctionnalité est construite
      (via l'admin ou `setFormationsFlags`).
