# Plateforme de prise de rendez-vous (booking)

Plateforme multi-tenant : des organisations (FGTB, CSC, CGSLB, CAPAC, ou toute
entreprise cliente) publient des créneaux ; les citoyens (connectés ou non)
réservent en ligne ; l'équipe valide.

## Modèle de données (`prisma/schema.prisma`, migration `36_add_booking`)
- **BookingTenant** — l'organisation (slug = URL publique `/{slug}/rendez-vous`).
  Config : `formFields` (formulaire), `requireApproval`, `autoApproveAfterHours`,
  `dedupeField`/`dedupeWindowDays` (anti-doublon), `brandColor`, `emailFromName`.
  `partnerOrganization` fait le pont avec `User.partnerOrganization` (auto-accès).
- **BookingTenantMember** — équipe (rôles `owner`/`manager`/`agent`).
- **BookingLocation** — antenne (adresse + géoloc pour le routage commune→antenne).
- **BookingSlotRule** — créneau hebdo récurrent `(weekday, start, end, capacity)`.
- **BookingException** — fermeture (`closed`) ou créneaux ponctuels (`extra`).
- **Booking** — la réservation (statuts : pending_approval → confirmed / rejected
  / cancelled_* / no_show / completed). Token opaque = gestion citoyen sans compte.

> ⚠️ Base Neon **partagée** : migrations additives idempotentes via
> `prisma db execute` (jamais `db push`).

## Logique (`lib/booking/`)
Modules purs (testés) : `availability` (créneaux libres), `form-fields` (Zod
dynamique + NRN mod-97), `dates` (heures murales UTC), `dedupe` (HMAC NRN).
Accès DB / effets : `availability-data`, `route-bureau` (haversine commune→antenne),
`access` (rôles), `emails` (Resend), `ics-adapter` (réutilise `lib/rendez-vous/ics`),
`notify`, `partner-guard`, `schemas` (Zod API), `status` (libellés FR).

## Routes
- Public : `/rendez-vous` (stepper de découverte), `/{slug}/rendez-vous`
  (réservation), `/rendez-vous/gestion/{token}` (gérer/annuler).
- Équipe : `/partenaire/booking` + onglets `agenda`/`creneaux`/`exceptions`/
  `configuration`/`equipe`.
- API : `/api/booking/{slug}/{availability,book,dedupe-check}`,
  `/api/booking/manage/{token}[/cancel|/ics]`, `/api/booking/partner/tenants/...`.
- Crons (`vercel.json`) : `booking-auto-approve` (horaire), `booking-reminders`
  (J-1), `booking-purge` (RGPD : anonymisation 6 mois, suppression 24 mois).

## Décisions produit
- Validation manuelle par défaut ; **auto-approbation** après `autoApproveAfterHours`
  (jamais laisser un citoyen sans réponse).
- Anti-doublon : 1 RDV / fenêtre (défaut 30 j). Au-delà → blocage avant le
  formulaire avec invitation à se présenter au bureau.
- Outil FGTB historique (.ics) → privé : `/partenaire/outils/fgtb-planning`.

## Seed / env
- `pnpm seed:booking` — crée les 4 organismes chômage + antenne démo + créneaux.
- Env : `RESEND_API_KEY`, `EMAIL_FROM`, `BETTER_AUTH_URL` (liens email),
  `CRON_SECRET` (crons), `BOOKING_NRN_SECRET` (optionnel, sinon dérivé d'auth).
