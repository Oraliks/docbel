# Tests E2E Playwright

Tests end-to-end pour les flows critiques de Beldoc, lancés via Playwright.

## Pré-requis

1. **Comptes demo seedés** :
   ```sh
   pnpm tsx scripts/seed-demo-accounts.ts
   ```
   Cela crée `demo+citoyen@docbel.local`, `demo+partenaire@docbel.local` et
   `demo+employeur@docbel.local`.

2. **Dev server lancé** sur `http://localhost:3000` :
   ```sh
   pnpm dev
   ```
   (Voir `feedback_dev_server_env` si tu rencontres un blocage de variables
   d'environnement.)

3. **Variables d'environnement E2E** pour le compte admin utilisé par les tests.
   À ajouter dans `.env.local` (ne PAS committer) :
   ```env
   E2E_ADMIN_EMAIL="ton-admin@docbel.be"
   E2E_ADMIN_PASSWORD="..."
   ```
   Sans ces variables, les tests sont **skipped** automatiquement.

## Lancer les tests

```sh
# Tous les tests E2E
pnpm test:e2e

# Un fichier précis
pnpm test:e2e tests/e2e/impersonation/basic-flow.spec.ts

# Mode interactif (UI Playwright)
pnpm exec playwright test --ui

# Lister les tests sans les lancer
pnpm exec playwright test --list
```

## Structure

```
tests/e2e/
  helpers/
    auth.ts                 # loginAsAdmin(), constantes DEMO_ACCOUNTS, skip si creds manquants
  impersonation/
    basic-flow.spec.ts      # admin → impersonifier citoyen → bannière → stop
    visitor-mode.spec.ts    # admin → visiteur anonyme → restore
    audit-log.spec.ts       # /admin/impersonation liste les events
```

## Notes

- **1 seul worker** : la DB Neon est partagée — pas de parallélisme aveugle.
- Les tests **ne créent pas** de fixtures DB. Ils utilisent uniquement les
  comptes demo existants et le compte admin défini en env.
- En `NODE_ENV=development`, le modal "raison" est court-circuité — c'est ce
  que les tests assument.
