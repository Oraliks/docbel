# RGPD_QUEUE — File conformité

Source : `docs/audits/AUDIT_RGPD_2026-06-06.md` (note 3,5/10). **C'est le bloquant V1.**
⚠️ **Aucun texte juridique ici n'est final.** Les brouillons/pages produits doivent être
**relus par un juriste IT belge** avant publication. Les items marqués 🧑‍⚖️ sortent du
périmètre code (décision/juridique).

## 1) Avant publication (BLOQUANT — faisable en code, faible risque)
- [x] Gater `<Analytics/>` (`app/layout.tsx`) + `<PageViewBeacon/>` (`app/[slug]/page.tsx`)
      derrière consentement. Fait via `<AnalyticsGate/>` / `<ConsentedPageViewBeacon/>`
      (`components/cookie-consent/analytics-gate.tsx`) : rien n'est monté sans accord
      « mesure d'audience ». Retrait → reload pour décharger le script Vercel déjà injecté.
- [x] Bannière de consentement : `components/cookie-consent/` (provider + banner + gate)
      + moteur pur `lib/cookie-consent/consent.ts`. Cookie `docbel-consent` (JSON versionné,
      6 mois, SameSite=Lax, lisible serveur/client), boutons « Tout accepter »/« Tout refuser »
      au même rang + « Personnaliser » + « Gérer mes cookies » (footer). 2 catégories :
      Nécessaires (verrouillées) + Mesure d'audience (opt-in, OFF par défaut). Front uniquement
      (hors /admin). i18n FR/NL/EN natif (`public.cookieConsent`), autres en fallback FR.
      ⚠️ Textes à faire relire par un juriste IT belge avant publication finale.
- [ ] Pages `/mentions-legales`, `/politique-confidentialite`, `/politique-cookies`
      (template `legal` existant `lib/page-builder/page-templates.ts`). **Brouillons**.
- [ ] Câbler footer `components/docbel/landing/footer.tsx` (3 `href="#"`).
- [ ] Corriger `lib/app-settings.ts` (« Aucun cookie de pistage tiers » = faux).
- [ ] Notice contextuelle IA (`intent-search.tsx`) : « requête analysée par Anthropic, USA »
      OU désactiver `/api/intent-detect` (fallback local).
- [ ] Case consentement art. 9 sur booking FGTB/CSC/CGSLB (`booking-flow.tsx`) — bloquante.

## 2) Juridique / documentaire (🧑‍⚖️ hors code, à acter par le propriétaire)
- [ ] 🧑‍⚖️ Choisir l'**entité responsable de traitement** (personne physique vs société) + BCE.
- [ ] 🧑‍⚖️ Créer l'alias `vie-privee@docbel.be` / `dpo@docbel.be`.
- [ ] 🧑‍⚖️ Faire **relire** mentions/confidentialité/CGU par un juriste IT belge.
- [ ] 🧑‍⚖️ Désigner formellement un **DPO** (acte interne, même solo dev).
- [ ] 🧑‍⚖️ Déposer la demande d'autorisation **NRN** au Comité sectoriel SPF Intérieur
      (loi 8 août 1983) — délai 2–4 mois.
- [ ] 🧑‍⚖️ Collecter et archiver les **DPA** des sous-traitants (Vercel, Neon, Anthropic,
      OpenAI, Voyage, Brave, Resend, Stripe, Google, OVH).

## 3) Technique (post-MVP rapproché — certains = plan dédié car migration)
- [ ] Droits personnes : `/api/me/export` (art. 20) + `/api/me/delete` transverse (art. 17).
- [ ] **FK Cascade** manquantes sur `User` (UserProfile, BundleRun, Booking, RendezVousHistory,
      ChatSession/Message/Memory, KnowledgeSource…). ⚠️ migration → **SQL additif `db execute`**,
      jamais `db push`. → plan dédié.
- [ ] Brancher l'écriture de `citizenNrnEnc` (`app/api/booking/[slug]/book/route.ts`) +
      le purger dans `app/api/cron/booking-purge/route.ts` (sinon colonne zombie / NRN résiduel).
- [ ] Créer le cron manquant `/api/documents/cron/purge` (BundleRun NISS/IBAN jamais purgés ;
      référencé dans `vercel.json` mais inexistant).
- [ ] Chiffrer `UserProfile.niss` (nissEnc/nissHash/nissLast4) + colonnes art. 9
      (`organismePaiement`, `mutuelleCode`). → plan dédié (migration + reprise crypto-nrn).
- [ ] `NrnAccessLog` Prisma + log à chaque déchiffrement NRN (`.../nrn/route.ts`).
- [ ] Cron purge `PageView` > 13 mois + anonymiser le referrer (`api/page-views`).
- [ ] Vercel Blob `access:'private'` + URLs signées pour les PDF contenant du NRN.
- [ ] Configurer Neon en **région UE** ; activer ZDR OpenAI Whisper ou désactiver la voix.
- [ ] 🧑‍⚖️ Faire pivoter le mot de passe Neon (visible dans `.env` partagé).

## 4) Long terme
- [ ] Registre des traitements art. 30 (`docs/rgpd/registre-traitements.md`).
- [ ] AIPD (art. 35) sur NRN, booking syndical, chomage-ia (template CNIL PIA).
- [ ] Procédure de violation art. 33-34 (`docs/rgpd/procedure-violation.md`) + table
      `RgpdIncident`. Monitoring erreurs (Sentry UE + DPA).
- [ ] MFA admin obligatoire ; découpe des secrets crypto ; auto-héberger flagcdn + pdf.js worker.

## Top 3 risques sanctionnables (rappel audit)
1. Bannière cookies absente + Vercel Analytics sans consentement → 50–200 k€.
2. Adhésion syndicale sans consentement art. 9 → 100–600 k€.
3. NRN sans autorisation SPF + stockage en clair → mise en demeure + 10–50 k€.

> Détail complet, articles cités, montants, ressources officielles :
> `docs/audits/AUDIT_RGPD_2026-06-06.md` (checklist lignes 511-551 ; avocat 554-569).
