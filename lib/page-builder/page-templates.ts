// =====================================================================
//  Page templates — pre-built block sequences for fast page creation.
// =====================================================================

import type { BlockProps } from './types'
import { nanoid } from 'nanoid'

export interface PageTemplate {
  id: string
  name: string
  description: string
  emoji: string
  category: 'general' | 'marketing' | 'content' | 'legal'
  blocks: BlockProps[]
}

const make = (b: Omit<BlockProps, 'id'>): BlockProps =>
  ({ ...b, id: nanoid() } as BlockProps)

export const PAGE_TEMPLATES: PageTemplate[] = [
  // ─────────────── General ───────────────
  {
    id: 'blank',
    name: 'Vierge',
    description: 'Une page vide pour partir de zéro',
    emoji: '📄',
    category: 'general',
    blocks: [],
  },

  // ─────────────── Marketing ───────────────
  {
    id: 'landing',
    name: 'Landing Page',
    description: 'Hero + features + témoignages + CTA',
    emoji: '🚀',
    category: 'marketing',
    blocks: [
      make({
        type: 'hero',
        props: {
          title: 'La solution qui change tout',
          subtitle: 'NOUVEAU',
          description:
            'Une description courte et engageante qui explique en quelques mots ce que vous proposez et pourquoi c’est différent.',
          ctaText: 'Commencer gratuitement',
          ctaLink: '#',
          ctaSecondaryText: 'En savoir plus',
          ctaSecondaryLink: '#',
          image: '',
          bgColor: '#111318',
          variant: 'centered',
        },
      }),
      make({
        type: 'features',
        props: {
          title: 'Pourquoi nous choisir',
          subtitle: 'Tout ce dont vous avez besoin, en un seul endroit.',
          columns: 3,
          variant: 'cards',
          items: [
            { icon: '⚡', title: 'Rapide', description: 'Performance optimale et chargement instantané.' },
            { icon: '🔒', title: 'Sécurisé', description: 'Données protégées avec les dernières normes.' },
            { icon: '📱', title: 'Responsive', description: 'Fonctionne sur tous vos appareils.' },
          ],
        },
      }),
      make({
        type: 'testimonial',
        props: {
          title: 'Ils nous font confiance',
          variant: 'single',
          items: [
            {
              quote: 'Un service exceptionnel qui a transformé notre quotidien. Je recommande !',
              author: 'Marie Dupont',
              role: 'CEO, Acme Inc.',
            },
          ],
        },
      }),
      make({
        type: 'cta',
        props: {
          title: 'Prêt à commencer ?',
          description: 'Rejoignez-nous dès aujourd’hui — c’est gratuit.',
          text: 'Commencer maintenant',
          link: '#',
          secondaryText: 'Voir la démo',
          secondaryLink: '#',
          variant: 'banner',
          buttonStyle: 'primary',
          buttonSize: 'lg',
        },
      }),
    ],
  },
  {
    id: 'product',
    name: 'Page produit',
    description: 'Hero split + stats + features',
    emoji: '🎁',
    category: 'marketing',
    blocks: [
      make({
        type: 'hero',
        props: {
          title: 'Un produit pensé pour vous',
          subtitle: 'PRODUIT',
          description: 'Tout ce qu’il faut savoir sur notre nouveau produit, en un coup d’œil.',
          ctaText: 'Acheter maintenant',
          ctaLink: '#',
          image: '',
          bgColor: '#1A1A24',
          variant: 'split',
        },
      }),
      make({
        type: 'stats',
        props: {
          title: '',
          columns: 4,
          variant: 'simple',
          items: [
            { value: '10', suffix: 'k+', label: 'Clients' },
            { value: '99', suffix: '%', label: 'Satisfaction' },
            { value: '24', suffix: '/7', label: 'Support' },
            { value: '50', suffix: '+', label: 'Pays' },
          ],
        },
      }),
      make({
        type: 'features',
        props: {
          title: 'Caractéristiques',
          subtitle: '',
          columns: 2,
          variant: 'icons',
          items: [
            { icon: '✨', title: 'Design soigné', description: 'Une expérience pensée dans le moindre détail.' },
            { icon: '🛠️', title: 'Personnalisable', description: 'Adaptez-le à vos besoins en quelques clics.' },
            { icon: '🌍', title: 'International', description: 'Disponible partout dans le monde.' },
            { icon: '🔄', title: 'Mises à jour', description: 'Toujours à la pointe avec nos updates régulières.' },
          ],
        },
      }),
    ],
  },
  {
    id: 'pricing',
    name: 'Page tarifs',
    description: 'Hero + features + FAQ + CTA',
    emoji: '💰',
    category: 'marketing',
    blocks: [
      make({
        type: 'hero',
        props: {
          title: 'Tarifs simples et transparents',
          description: 'Choisissez l’offre qui vous correspond. Pas de frais cachés.',
          ctaText: '',
          ctaLink: '',
          image: '',
          bgColor: '',
          variant: 'minimal',
        },
      }),
      make({
        type: 'features',
        props: {
          title: '',
          subtitle: '',
          columns: 3,
          variant: 'cards',
          items: [
            { icon: '🆓', title: 'Gratuit', description: 'Pour découvrir et tester.' },
            { icon: '⭐', title: 'Pro — 19€/mois', description: 'Pour les professionnels exigeants.' },
            { icon: '🏢', title: 'Entreprise', description: 'Sur mesure, contactez-nous.' },
          ],
        },
      }),
      make({
        type: 'faq',
        props: {
          title: 'Questions fréquentes',
          variant: 'simple',
          items: [
            { question: 'Puis-je changer d’offre à tout moment ?', answer: 'Oui, vous pouvez mettre à niveau ou rétrograder à tout moment.' },
            { question: 'Y a-t-il une période d’essai ?', answer: 'L’offre Pro est gratuite pendant 14 jours, sans carte bancaire.' },
            { question: 'Quels moyens de paiement ?', answer: 'Carte bancaire, PayPal et virement (entreprise).' },
          ],
        },
      }),
    ],
  },

  // ─────────────── Content ───────────────
  {
    id: 'about',
    name: 'À propos',
    description: 'Hero + texte + équipe',
    emoji: '🏢',
    category: 'content',
    blocks: [
      make({
        type: 'hero',
        props: {
          title: 'À propos de nous',
          description: 'Notre histoire, notre équipe et ce qui nous anime.',
          ctaText: '',
          ctaLink: '',
          image: '',
          bgColor: '',
          variant: 'minimal',
        },
      }),
      make({
        type: 'heading',
        props: { text: 'Notre mission', level: 2, variant: 'default' },
      }),
      make({
        type: 'text',
        props: {
          html: '<p>Décrivez votre mission, votre vision, et ce qui rend votre entreprise unique. Ce paragraphe sert d’introduction à votre histoire.</p>',
          variant: 'lead',
        },
      }),
      make({
        type: 'heading',
        props: { text: 'L’équipe', level: 2, variant: 'default' },
      }),
      make({
        type: 'features',
        props: {
          title: '',
          subtitle: '',
          columns: 3,
          variant: 'centered',
          items: [
            { icon: '👤', title: 'Alice Martin', description: 'CEO & Fondatrice' },
            { icon: '👤', title: 'Bob Durand', description: 'CTO' },
            { icon: '👤', title: 'Claire Petit', description: 'Designer' },
          ],
        },
      }),
    ],
  },
  {
    id: 'contact',
    name: 'Contact',
    description: 'Hero + infos + CTA',
    emoji: '📞',
    category: 'content',
    blocks: [
      make({
        type: 'hero',
        props: {
          title: 'Contactez-nous',
          description: 'Une question ? Une suggestion ? On vous répond rapidement.',
          ctaText: '',
          ctaLink: '',
          image: '',
          bgColor: '',
          variant: 'minimal',
        },
      }),
      make({
        type: 'features',
        props: {
          title: '',
          subtitle: '',
          columns: 3,
          variant: 'icons',
          items: [
            { icon: '📧', title: 'Email', description: 'contact@exemple.com' },
            { icon: '📞', title: 'Téléphone', description: '+32 2 123 45 67' },
            { icon: '📍', title: 'Adresse', description: 'Rue de l’Exemple 1, 1000 Bruxelles' },
          ],
        },
      }),
      make({
        type: 'cta',
        props: {
          title: 'Envoyez-nous un message',
          description: 'Nous répondons en moins de 24h.',
          text: 'Nous écrire',
          link: 'mailto:contact@exemple.com',
          variant: 'card',
          buttonStyle: 'primary',
          buttonSize: 'md',
        },
      }),
    ],
  },
  {
    id: 'article',
    name: 'Article long',
    description: 'Titre + lead + sections + citation + CTA',
    emoji: '📰',
    category: 'content',
    blocks: [
      make({
        type: 'heading',
        props: { text: 'Titre de l’article', level: 1, variant: 'display' },
      }),
      make({
        type: 'text',
        props: {
          html: '<p>Un sous-titre ou résumé qui donne envie de lire la suite.</p>',
          variant: 'lead',
        },
      }),
      make({ type: 'divider', props: { variant: 'solid', thickness: 1 } }),
      make({ type: 'heading', props: { text: 'Section 1', level: 2, variant: 'default' } }),
      make({
        type: 'text',
        props: {
          html: '<p>Premier paragraphe de votre article. Vous pouvez ajouter <strong>du gras</strong>, de <em>l’italique</em>, ou des <a href="#">liens</a>.</p>',
          variant: 'default',
        },
      }),
      make({
        type: 'quote',
        props: {
          text: 'Une citation marquante qui résume votre propos.',
          author: 'Auteur',
          role: '',
          variant: 'pull',
        },
      }),
      make({ type: 'heading', props: { text: 'Section 2', level: 2, variant: 'default' } }),
      make({
        type: 'text',
        props: {
          html: '<p>Continuez à raconter votre histoire ici.</p>',
          variant: 'default',
        },
      }),
      make({
        type: 'cta',
        props: {
          text: 'Partager cet article',
          link: '#',
          variant: 'inline',
          buttonStyle: 'outline',
          buttonSize: 'md',
        },
      }),
    ],
  },
  {
    id: 'gallery',
    name: 'Galerie',
    description: 'Page galerie d’images',
    emoji: '🖼️',
    category: 'content',
    blocks: [
      make({
        type: 'hero',
        props: {
          title: 'Galerie',
          description: 'Quelques moments capturés.',
          ctaText: '',
          ctaLink: '',
          image: '',
          bgColor: '',
          variant: 'minimal',
        },
      }),
      make({
        type: 'gallery',
        props: {
          columns: 3,
          variant: 'grid',
          gap: 'md',
          items: [
            { url: '', alt: 'Image 1' },
            { url: '', alt: 'Image 2' },
            { url: '', alt: 'Image 3' },
            { url: '', alt: 'Image 4' },
            { url: '', alt: 'Image 5' },
            { url: '', alt: 'Image 6' },
          ],
        },
      }),
    ],
  },
  {
    id: 'faq',
    name: 'FAQ',
    description: 'Page de questions / réponses',
    emoji: '❓',
    category: 'content',
    blocks: [
      make({
        type: 'hero',
        props: {
          title: 'Questions fréquentes',
          description: 'Vous avez une question ? Vous trouverez probablement la réponse ici.',
          ctaText: '',
          ctaLink: '',
          image: '',
          bgColor: '',
          variant: 'minimal',
        },
      }),
      make({
        type: 'faq',
        props: {
          title: '',
          variant: 'bordered',
          items: [
            { question: 'Comment créer un compte ?', answer: 'Cliquez sur “S’inscrire” en haut à droite et suivez les étapes.' },
            { question: 'Comment réinitialiser mon mot de passe ?', answer: 'Sur la page de connexion, cliquez sur “Mot de passe oublié” et entrez votre email.' },
            { question: 'Comment contacter le support ?', answer: 'Écrivez-nous à support@exemple.com — nous répondons en moins de 24h.' },
          ],
        },
      }),
      make({
        type: 'cta',
        props: {
          title: 'Vous n’avez pas trouvé votre réponse ?',
          description: 'Notre équipe est là pour vous aider.',
          text: 'Nous contacter',
          link: '#',
          variant: 'card',
          buttonStyle: 'primary',
          buttonSize: 'md',
        },
      }),
    ],
  },

  // ─────────────── DocBel-specific ───────────────
  {
    id: 'demarche',
    name: 'Démarche administrative',
    description: 'Hero + étapes + documents + FAQ',
    emoji: '📋',
    category: 'content',
    blocks: [
      make({
        type: 'hero',
        props: {
          title: 'Comment faire valoir vos droits',
          subtitle: 'GUIDE PAS-À-PAS',
          description: 'Toutes les étapes pour effectuer cette démarche, avec les documents nécessaires.',
          ctaText: '',
          ctaLink: '',
          image: '',
          bgColor: '',
          variant: 'minimal',
        },
      }),
      make({
        type: 'alert',
        props: {
          title: 'Important',
          message: 'Munissez-vous de votre carte d’identité et de vos documents officiels avant de commencer.',
          variant: 'info',
          icon: 'info',
          dismissible: false,
        },
      }),
      make({
        type: 'steps',
        props: {
          title: 'Procédure',
          subtitle: '',
          items: [
            { title: 'Préparer les documents', description: 'Rassemblez tous les justificatifs requis.', icon: 'file-text' },
            { title: 'Compléter le formulaire', description: 'Remplissez le formulaire en ligne ou papier.', icon: 'pencil' },
            { title: 'Déposer la demande', description: 'Soumettez votre dossier à l’organisme compétent.', icon: 'check' },
          ],
          orientation: 'horizontal',
          variant: 'numbered',
        },
      }),
      make({
        type: 'document',
        props: {
          title: 'Formulaire officiel',
          description: 'Téléchargez et remplissez ce formulaire pour démarrer la procédure.',
          fileType: 'pdf',
          variant: 'card',
          size: '',
          date: '',
        },
      }),
      make({
        type: 'faq',
        props: {
          title: 'Questions fréquentes',
          items: [
            { question: 'Combien de temps prend la démarche ?', answer: 'En moyenne 4 à 6 semaines.' },
            { question: 'Que faire en cas de refus ?', answer: 'Vous pouvez introduire un recours sous 30 jours.' },
            { question: 'À qui m’adresser ?', answer: 'Contactez l’organisme indiqué dans la décision.' },
          ],
          variant: 'bordered',
        },
      }),
    ],
  },
  {
    id: 'organisme-page',
    name: 'Fiche organisme',
    description: 'Hero + organisme + horaires + documents',
    emoji: '🏛️',
    category: 'content',
    blocks: [
      make({
        type: 'hero',
        props: {
          title: 'Nom de l’organisme',
          subtitle: 'CONTACT',
          description: 'Informations pratiques pour entrer en contact avec cet organisme.',
          image: '',
          bgColor: '',
          variant: 'minimal',
        },
      }),
      make({
        type: 'organisme',
        props: {
          name: 'Nom de l’organisme',
          description: 'Présentation et missions de l’organisme.',
          address: 'Rue de l’Exemple 1, 1000 Bruxelles',
          phone: '+32 2 123 45 67',
          email: 'contact@exemple.be',
          website: 'https://exemple.be',
          hours: 'Lun-Ven 9h-17h',
          logo: '',
          variant: 'detailed',
        },
      }),
      make({
        type: 'glossary',
        props: {
          title: 'Termes utiles',
          items: [
            { term: 'Allocation', definition: 'Montant versé par un organisme public.' },
            { term: 'Recours', definition: 'Procédure pour contester une décision.' },
          ],
          variant: 'list',
        },
      }),
    ],
  },
  {
    id: 'app-landing',
    name: 'Landing app',
    description: 'Hero + features + counter + CTA',
    emoji: '📱',
    category: 'marketing',
    blocks: [
      make({
        type: 'hero',
        props: {
          title: 'Une app qui simplifie tout',
          subtitle: 'NOUVEAU',
          description: 'Découvrez la nouvelle génération de notre application.',
          ctaText: 'Télécharger',
          ctaLink: '#',
          ctaSecondaryText: 'Voir la démo',
          ctaSecondaryLink: '#',
          image: '',
          bgColor: '#0F172A',
          variant: 'split',
        },
      }),
      make({
        type: 'counter',
        props: {
          title: '',
          items: [
            { value: 50000, label: 'Téléchargements', suffix: '+' },
            { value: 4.9, label: 'Note App Store', suffix: '/5' },
            { value: 99, label: 'Disponibilité', suffix: '%' },
          ],
          columns: 3,
          duration: 2000,
        },
      }),
      make({
        type: 'features',
        props: {
          title: 'Fonctionnalités clés',
          subtitle: '',
          columns: 3,
          variant: 'cards',
          items: [
            { icon: 'zap', title: 'Ultra rapide', description: 'Performance native sur tous les appareils.' },
            { icon: 'shield', title: 'Sécurisée', description: 'Chiffrement bout en bout.' },
            { icon: 'sparkles', title: 'Intuitive', description: 'Une interface qui parle d’elle-même.' },
          ],
        },
      }),
      make({
        type: 'cta',
        props: {
          title: 'Prêt à essayer ?',
          description: 'Téléchargez gratuitement.',
          text: 'Télécharger',
          link: '#',
          variant: 'banner',
          buttonStyle: 'primary',
          buttonSize: 'lg',
        },
      }),
    ],
  },

  // ─────────────── Legal ───────────────
  {
    id: 'legal',
    name: 'Page légale',
    description: 'Mentions légales / CGU / Politique',
    emoji: '⚖️',
    category: 'legal',
    blocks: [
      make({ type: 'heading', props: { text: 'Mentions légales', level: 1, variant: 'default' } }),
      make({
        type: 'text',
        props: {
          html: '<p>Dernière mise à jour : [DATE].</p>',
          variant: 'small',
        },
      }),
      make({ type: 'heading', props: { text: '1. Éditeur du site', level: 2, variant: 'default' } }),
      make({
        type: 'text',
        props: {
          html: '<p>Nom de la société, adresse, numéro d’entreprise, etc.</p>',
          variant: 'default',
        },
      }),
      make({ type: 'heading', props: { text: '2. Hébergement', level: 2, variant: 'default' } }),
      make({
        type: 'text',
        props: {
          html: '<p>Informations sur l’hébergeur du site.</p>',
          variant: 'default',
        },
      }),
      make({ type: 'heading', props: { text: '3. Données personnelles', level: 2, variant: 'default' } }),
      make({
        type: 'text',
        props: {
          html: '<p>Politique de traitement des données personnelles.</p>',
          variant: 'default',
        },
      }),
    ],
  },
]

export function getTemplateById(id: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.id === id)
}

export function getTemplateBlocks(id: string): BlockProps[] {
  const template = getTemplateById(id)
  if (!template) return []
  return template.blocks.map((block) =>
    structuredClone({ ...block, id: nanoid() })
  ) as BlockProps[]
}
