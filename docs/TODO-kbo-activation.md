# 🔖 TODO — Activation de l'autofill entreprise (KBO/BCE)

**Statut : en attente — à activer plus tard.**

## Pourquoi c'est en attente

L'inscription à la KBO Open Data (`kbopub.economie.fgov.be/kbo-open-data`)
exige actuellement de disposer d'un **numéro d'entreprise belge** (BCE). Tant
qu'on n'a pas de société enregistrée, on ne peut pas créer le compte qui donne
les identifiants de téléchargement.

Tout le code est **déjà en place et testé** — il ne manque que les identifiants
et le déclenchement de la première ingestion.

## Ce qui marche déjà sans inscription

- **VIES (TVA UE)** — `GET /api/admin/lookup/vat?country=BE&number=0123456789`.
  Gratuit, sans compte. Renvoie `{ valid, name, address, parsedAddress }`.
  → Utilisable **dès maintenant** pour l'autofill via numéro de TVA.

## Checklist d'activation (le jour où on a une société)

1. Créer un compte sur https://kbopub.economie.fgov.be/kbo-open-data (email +
   vérification ; nécessite un n° d'entreprise).
2. Ajouter aux variables d'environnement Vercel (Production + Preview) :
   - `KBO_OPEN_DATA_USER`
   - `KBO_OPEN_DATA_PASSWORD`
   - (optionnel) `KBO_OPEN_DATA_URL` si l'URL du fichier change.
3. Première hydratation de la base (le dump complet ~2 M entreprises dépasse le
   timeout serverless de Vercel) :
   - **Soit** lancer depuis un runner non-serverless (GitHub Action / machine
     locale) qui appelle `runKboEtl()` (`lib/be-companies/kbo-etl.ts`).
   - **Soit** un test partiel en prod : `POST /api/admin/lookup/bce/refresh?max=10000`
     (admin connecté) pour valider le flux sur un sous-ensemble.
4. Vérifier une recherche : `GET /api/admin/lookup/bce?number=<un BCE connu>`.
5. La cron mensuelle `/api/cron/kbo-refresh` (le 5 du mois à 3h, cf.
   `vercel.json`) prendra ensuite le relais. Tant que les identifiants sont
   absents, elle est **no-op** (ne casse rien).

## Fichiers concernés

- `lib/be-companies/vies.ts` — client VIES (live).
- `lib/be-companies/kbo-etl.ts` — téléchargement + ingestion.
- `lib/be-companies/kbo-csv-parser.ts` — parsing CSV streaming.
- `lib/be-companies/kbo-lookup.ts` — recherche (numéro / nom).
- `app/api/admin/lookup/{vat,bce}/…` — routes admin.
- `app/api/cron/kbo-refresh/route.ts` — cron mensuelle.
- `prisma/schema.prisma` — modèles `Kbo*`.

## Note sur l'ONSS

Il n'existe **pas** d'API publique de lookup ONSS. Le numéro ONSS (employeur)
est une inscription distincte du BCE, non récupérable depuis les sources
ouvertes. On le garde donc en **champ saisi** sur le profil utilisateur
(`employerBce` existe déjà). KBO reste la source primaire pour les données
d'entreprise.
