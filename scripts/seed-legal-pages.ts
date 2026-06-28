// =====================================================================
//  Seed — pages légales (BROUILLON) : mentions légales, politique de
//  confidentialité, politique de cookies.
// ---------------------------------------------------------------------
//  Crée (ou met à jour) trois pages builder en `status: 'draft'`, bâties
//  sur le vocabulaire du template `legal` (heading / text / alert) de
//  `lib/page-builder/page-templates.ts`.
//
//  ⚠️ BROUILLON — aucun texte ici n'est juridiquement validé. Chaque fait
//  concret (dénomination de l'ASBL, n° BCE, siège, DPO, durées, bases
//  légales…) est un PLACEHOLDER `[À COMPLÉTER : …]` à renseigner, puis
//  l'ensemble doit être RELU PAR UN JURISTE IT BELGE avant publication.
//  Tant que `status` reste `draft`, la page n'est PAS rendue publiquement
//  (le catch-all `app/[slug]/page.tsx` ne sert que published/scheduled).
//
//  Idempotent : crée la page si absente, sinon met à jour le contenu et
//  les métas SANS toucher au `status` (pour ne pas re-brouillonner une
//  page déjà publiée après relecture). À lancer via :
//    npx tsx scripts/seed-legal-pages.ts
// =====================================================================

import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'

interface Block {
  id: string
  type: string
  props: Record<string, unknown>
}

const block = (type: string, props: Record<string, unknown>): Block => ({
  id: nanoid(),
  type,
  props,
})

const h1 = (text: string) => block('heading', { text, level: 1, variant: 'default' })
const h2 = (text: string) => block('heading', { text, level: 2, variant: 'default' })
const p = (html: string) => block('text', { html, variant: 'default' })
const small = (html: string) => block('text', { html, variant: 'small' })

// Bandeau « brouillon » réutilisé en tête de chaque page.
const draftNotice = () =>
  block('alert', {
    title: 'Brouillon — non contractuel',
    message:
      'Ce document est un brouillon de travail. Il n’a pas encore été validé ' +
      'par un juriste et ne doit pas être considéré comme définitif. Les ' +
      'informations entre crochets [À COMPLÉTER] restent à renseigner.',
    variant: 'warning',
    icon: 'alert-triangle',
    dismissible: false,
  })

interface LegalPage {
  slug: string
  title: string
  metaTitle: string
  metaDesc: string
  blocks: Block[]
}

// ─────────────────────────────────────────────────────────────────────
//  1) Mentions légales
// ─────────────────────────────────────────────────────────────────────
const mentionsLegales: LegalPage = {
  slug: 'mentions-legales',
  title: 'Mentions légales',
  metaTitle: 'Mentions légales — Docbel',
  metaDesc:
    'Éditeur, hébergement et informations légales du site Docbel (brouillon).',
  blocks: [
    draftNotice(),
    h1('Mentions légales'),
    small('<p>Dernière mise à jour : [À COMPLÉTER : DATE].</p>'),
    p(
      '<p>Les présentes mentions légales encadrent l’accès et l’utilisation ' +
        'du site Docbel (ci-après « le Site »).</p>',
    ),

    h2('1. Éditeur du site'),
    p(
      '<p>Le Site est édité par&nbsp;:</p>' +
        '<ul>' +
        '<li><strong>[À COMPLÉTER : DÉNOMINATION DE L’ASBL]</strong> — association sans but lucratif de droit belge <em>(en cours de constitution)</em>&nbsp;;</li>' +
        '<li>Siège social&nbsp;: [À COMPLÉTER : ADRESSE COMPLÈTE DU SIÈGE]&nbsp;;</li>' +
        '<li>Numéro d’entreprise (BCE)&nbsp;: [À COMPLÉTER : N° BCE — en cours d’attribution]&nbsp;;</li>' +
        '<li>Représentée par&nbsp;: [À COMPLÉTER : NOM, qualité — ex. administrateur·rice]&nbsp;;</li>' +
        '<li>Courriel de contact&nbsp;: [À COMPLÉTER : contact@docbel.be].</li>' +
        '</ul>',
    ),

    h2('2. Directeur de la publication'),
    p('<p>[À COMPLÉTER : NOM du responsable de la publication].</p>'),

    h2('3. Hébergement'),
    p(
      '<p>Le Site est hébergé par&nbsp;:</p>' +
        '<ul>' +
        '<li><strong>Vercel Inc.</strong> (hébergement applicatif) — [À COMPLÉTER : adresse / région de traitement]&nbsp;;</li>' +
        '<li><strong>Neon</strong> (base de données PostgreSQL) — [À COMPLÉTER : adresse / région de traitement].</li>' +
        '</ul>' +
        '<p>[À COMPLÉTER : préciser la région d’hébergement des données — voir politique de confidentialité.]</p>',
    ),

    h2('4. Propriété intellectuelle'),
    p(
      '<p>Sauf mention contraire, les contenus du Site (textes, mise en page, ' +
        'éléments graphiques, code) sont la propriété de l’éditeur ou utilisés ' +
        'avec autorisation. Les contenus de source officielle (ex. ONEM) sont ' +
        'réutilisés selon leurs conditions propres, avec mention de la source ' +
        'et de la date. Toute reproduction non autorisée est interdite.</p>',
    ),

    h2('5. Nature informative du service'),
    p(
      '<p>Docbel fournit une aide à l’information administrative. Les contenus ' +
        'sont fournis à titre <strong>informatif</strong> et ne constituent ni un ' +
        'conseil juridique individualisé, ni une décision d’un organisme officiel ' +
        '(ONEM, CPAS, syndicat, employeur…). En cas de doute, seules les sources ' +
        'officielles et les organismes compétents font foi.</p>',
    ),

    h2('6. Assistance par intelligence artificielle'),
    p(
      '<p>Certaines fonctionnalités et certaines traductions du Site peuvent ' +
        'être générées ou assistées par des systèmes d’intelligence artificielle. ' +
        'Ces contenus peuvent comporter des erreurs et doivent être vérifiés. ' +
        '[À COMPLÉTER : prestataires IA et localisation — voir politique de ' +
        'confidentialité.]</p>',
    ),

    h2('7. Signaler une erreur / nous contacter'),
    p(
      '<p>Pour signaler une erreur ou poser une question&nbsp;: ' +
        '[À COMPLÉTER : contact@docbel.be].</p>',
    ),

    h2('8. Données personnelles et cookies'),
    p(
      '<p>Le traitement des données personnelles est décrit dans la ' +
        '<a href="/politique-confidentialite">politique de confidentialité</a>. ' +
        'L’usage des cookies est décrit dans la ' +
        '<a href="/politique-cookies">politique de cookies</a>.</p>',
    ),
  ],
}

// ─────────────────────────────────────────────────────────────────────
//  2) Politique de confidentialité
// ─────────────────────────────────────────────────────────────────────
const politiqueConfidentialite: LegalPage = {
  slug: 'politique-confidentialite',
  title: 'Politique de confidentialité',
  metaTitle: 'Politique de confidentialité — Docbel',
  metaDesc:
    'Comment Docbel traite vos données personnelles (RGPD) — brouillon à valider.',
  blocks: [
    draftNotice(),
    h1('Politique de confidentialité'),
    small('<p>Dernière mise à jour : [À COMPLÉTER : DATE].</p>'),
    p(
      '<p>La présente politique explique comment Docbel collecte et traite vos ' +
        'données personnelles, conformément au Règlement général sur la ' +
        'protection des données (RGPD) et à la loi belge applicable.</p>',
    ),

    h2('1. Responsable du traitement'),
    p(
      '<ul>' +
        '<li>[À COMPLÉTER : DÉNOMINATION DE L’ASBL], BCE [À COMPLÉTER : N° BCE]&nbsp;;</li>' +
        '<li>Siège&nbsp;: [À COMPLÉTER : ADRESSE]&nbsp;;</li>' +
        '<li>Contact vie privée&nbsp;: [À COMPLÉTER : vie-privee@docbel.be]&nbsp;;</li>' +
        '<li>Délégué à la protection des données (DPO)&nbsp;: [À COMPLÉTER : NOM / dpo@docbel.be, ou « non désigné à ce stade »].</li>' +
        '</ul>',
    ),

    h2('2. Données que nous traitons'),
    p(
      '<ul>' +
        '<li><strong>Compte</strong>&nbsp;: adresse e-mail, [À COMPLÉTER : autres champs de compte]&nbsp;;</li>' +
        '<li><strong>Dossier / profil</strong>&nbsp;: situation administrative, [À COMPLÉTER : champs collectés]&nbsp;;</li>' +
        '<li><strong>Numéro de registre national (NRN / NISS)</strong>&nbsp;: uniquement lorsque la démarche le requiert — voir section 5&nbsp;;</li>' +
        '<li><strong>Formulaires et demandes</strong> que vous complétez&nbsp;;</li>' +
        '<li><strong>Mesure d’audience</strong> (si vous y consentez)&nbsp;: pages consultées, données techniques agrégées&nbsp;;</li>' +
        '<li><strong>Journaux techniques</strong> (logs de sécurité, [À COMPLÉTER : durée]).</li>' +
        '</ul>',
    ),

    h2('3. Finalités et bases légales'),
    p(
      '<ul>' +
        '<li>Fournir le service et gérer votre compte — <em>exécution du service</em> (art. 6.1.b RGPD)&nbsp;;</li>' +
        '<li>Mesure d’audience — <em>consentement</em> (art. 6.1.a), retirable à tout moment&nbsp;;</li>' +
        '<li>Données sensibles (voir section 4) — <em>consentement explicite</em> (art. 9.2.a)&nbsp;;</li>' +
        '<li>Sécurité et prévention des abus — <em>intérêt légitime</em> (art. 6.1.f)&nbsp;;</li>' +
        '<li>Obligations légales éventuelles — <em>obligation légale</em> (art. 6.1.c).</li>' +
        '</ul>' +
        '<p>[À COMPLÉTER : valider les finalités et bases légales avec un juriste.]</p>',
    ),

    h2('4. Données sensibles (art. 9 RGPD)'),
    p(
      '<p>Certaines démarches peuvent révéler des données sensibles (par ex. ' +
        'une <strong>affiliation syndicale</strong> lors d’une prise de rendez-vous ' +
        'avec une organisation syndicale). Ces données ne sont traitées qu’avec ' +
        'votre <strong>consentement explicite</strong>, et uniquement pour la ' +
        'finalité concernée. [À COMPLÉTER : détailler les traitements art. 9.]</p>',
    ),

    h2('5. Numéro de registre national (NRN / NISS)'),
    p(
      '<p>Le NRN n’est traité que lorsqu’une démarche l’exige. ' +
        '[À COMPLÉTER : base légale — autorisation du Comité sectoriel compétent ' +
        '(loi du 8 août 1983), statut de la demande.] Il est stocké de manière ' +
        'sécurisée (chiffrement) et son accès est limité et journalisé.</p>',
    ),

    h2('6. Destinataires et sous-traitants'),
    p(
      '<p>Vos données peuvent être traitées par des sous-traitants agissant pour ' +
        'notre compte, notamment&nbsp;: [À COMPLÉTER : liste à confirmer — ex. ' +
        'Vercel (hébergement), Neon (base de données), Anthropic (assistance IA), ' +
        '[autres : OpenAI, Voyage, Brave, Resend, Stripe…]]. Un accord de ' +
        'traitement (DPA) est conclu avec chacun. [À COMPLÉTER : confirmer la ' +
        'liste et archiver les DPA.]</p>',
    ),

    h2('7. Transferts hors Union européenne'),
    p(
      '<p>Certains sous-traitants peuvent traiter des données en dehors de l’UE ' +
        '(par ex. aux États-Unis). [À COMPLÉTER : préciser les garanties — ' +
        'clauses contractuelles types, décision d’adéquation, etc.]</p>',
    ),

    h2('8. Durées de conservation'),
    p(
      '<p>[À COMPLÉTER : durées par catégorie de données — compte, dossier, NRN, ' +
        'mesure d’audience (ex. ≤ 13 mois), journaux.] Les données sont ensuite ' +
        'supprimées ou anonymisées.</p>',
    ),

    h2('9. Vos droits'),
    p(
      '<p>Vous disposez des droits d’accès, de rectification, d’effacement, de ' +
        'limitation, d’opposition, de portabilité, et du droit de retirer votre ' +
        'consentement à tout moment (sans effet rétroactif). Pour les exercer&nbsp;: ' +
        '[À COMPLÉTER : vie-privee@docbel.be]. [À COMPLÉTER : délai de réponse et ' +
        'pièces justificatives éventuelles.]</p>',
    ),

    h2('10. Réclamation'),
    p(
      '<p>Vous pouvez introduire une réclamation auprès de l’Autorité de ' +
        'protection des données (APD)&nbsp;: Rue de la Presse 35, 1000 Bruxelles — ' +
        'contact@apd-gba.be — www.autoriteprotectiondonnees.be.</p>',
    ),

    h2('11. Modifications'),
    p(
      '<p>Cette politique peut être mise à jour. La date de dernière mise à jour ' +
        'figure en tête de page.</p>',
    ),

    h2('12. Cookies'),
    p(
      '<p>L’usage des cookies est détaillé dans la ' +
        '<a href="/politique-cookies">politique de cookies</a>.</p>',
    ),
  ],
}

// ─────────────────────────────────────────────────────────────────────
//  3) Politique de cookies
// ─────────────────────────────────────────────────────────────────────
const politiqueCookies: LegalPage = {
  slug: 'politique-cookies',
  title: 'Politique de cookies',
  metaTitle: 'Politique de cookies — Docbel',
  metaDesc:
    'Cookies utilisés par Docbel et gestion de vos préférences — brouillon.',
  blocks: [
    draftNotice(),
    h1('Politique de cookies'),
    small('<p>Dernière mise à jour : [À COMPLÉTER : DATE].</p>'),
    p(
      '<p>Cette politique explique quels cookies et technologies similaires sont ' +
        'utilisés sur le Site et comment gérer vos préférences.</p>',
    ),

    h2('1. Qu’est-ce qu’un cookie ?'),
    p(
      '<p>Un cookie est un petit fichier déposé sur votre appareil lors de la ' +
        'visite d’un site. Il permet, entre autres, de mémoriser des préférences ' +
        'ou de mesurer l’audience.</p>',
    ),

    h2('2. Cookies strictement nécessaires'),
    p(
      '<p>Indispensables au fonctionnement du Site, ils ne requièrent pas votre ' +
        'consentement&nbsp;:</p>' +
        '<ul>' +
        '<li><code>docbel-consent</code> — mémorise vos choix de consentement (durée&nbsp;: 6 mois)&nbsp;;</li>' +
        '<li>[À COMPLÉTER : cookie de session / authentification le cas échéant].</li>' +
        '</ul>',
    ),

    h2('3. Mesure d’audience'),
    p(
      '<p>Soumise à votre consentement, <strong>désactivée par défaut</strong>. ' +
        'Elle n’est activée que si vous l’acceptez dans la bannière. ' +
        '[À COMPLÉTER : outil de mesure (ex. Vercel Analytics), données collectées ' +
        'et durée de conservation (ex. ≤ 13 mois).]</p>',
    ),

    h2('4. Pas de cookies publicitaires tiers'),
    p(
      '<p>Le Site n’utilise pas de cookies publicitaires ni de traceurs ' +
        'publicitaires tiers. [À COMPLÉTER : confirmer après audit de l’ensemble ' +
        'des scripts tiers.]</p>',
    ),

    h2('5. Gérer vos préférences'),
    p(
      '<p>Vous pouvez à tout moment modifier vos choix via le lien ' +
        '« Gérer mes cookies » présent en bas de page. Vous pouvez également ' +
        'configurer votre navigateur pour bloquer ou supprimer les cookies.</p>',
    ),

    h2('6. Modifications'),
    p(
      '<p>Cette politique peut évoluer. La date de dernière mise à jour figure ' +
        'en tête de page.</p>',
    ),

    h2('7. En savoir plus'),
    p(
      '<p>Pour le traitement des données personnelles, voir la ' +
        '<a href="/politique-confidentialite">politique de confidentialité</a>.</p>',
    ),
  ],
}

const PAGES: LegalPage[] = [
  mentionsLegales,
  politiqueConfidentialite,
  politiqueCookies,
]

async function main(): Promise<void> {
  for (const page of PAGES) {
    const existing = await prisma.page.findFirst({ where: { slug: page.slug } })

    if (!existing) {
      const created = await prisma.page.create({
        data: {
          title: page.title,
          slug: page.slug,
          status: 'draft', // BROUILLON : non rendu publiquement tant que non publié.
          metaTitle: page.metaTitle,
          metaDesc: page.metaDesc,
          content: page.blocks as unknown as object,
        },
      })
      console.log(
        `[seed-legal-pages] Créée : /${created.slug} (id ${created.id}, status=draft).`,
      )
      continue
    }

    // Idempotent : on rafraîchit le contenu et les métas, SANS écraser le
    // `status` (pour ne pas re-brouillonner une page déjà publiée/relue).
    const updated = await prisma.page.update({
      where: { id: existing.id },
      data: {
        title: page.title,
        metaTitle: page.metaTitle,
        metaDesc: page.metaDesc,
        content: page.blocks as unknown as object,
      },
    })
    console.log(
      `[seed-legal-pages] Mise à jour : /${updated.slug} (id ${updated.id}, status=${updated.status} inchangé).`,
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
