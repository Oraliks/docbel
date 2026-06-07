// =====================================================================
//  Section templates — ready-made, pre-filled block compositions the user
//  inserts in one click from the block picker. IDs here are template-local;
//  `insertTemplate` (store) remaps them to fresh ids on insertion.
// =====================================================================

import type { BlockProps } from './types'

export interface SectionTemplate {
  id: string
  name: string
  description: string
  blocks: BlockProps[]
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: 'hero-centered',
    name: 'Hero — En-tête',
    description: 'Grand titre, accroche et deux boutons',
    blocks: [
      {
        id: 't_hero',
        type: 'hero',
        props: {
          title: 'Votre titre accrocheur',
          subtitle: 'Une accroche courte',
          description:
            'Décrivez votre proposition de valeur en une phrase claire et convaincante.',
          ctaText: 'Commencer',
          ctaLink: '#',
          ctaSecondaryText: 'En savoir plus',
          ctaSecondaryLink: '#',
          variant: 'centered',
        },
      },
    ],
  },
  {
    id: 'features-3',
    name: 'Caractéristiques (3 colonnes)',
    description: 'Titre + grille de 3 cartes',
    blocks: [
      {
        id: 't_feat_sec',
        type: 'section',
        props: { layoutMode: 'stack', layoutAlign: 'center', layoutGap: 'lg' },
      },
      {
        id: 't_feat_h',
        type: 'heading',
        parentId: 't_feat_sec',
        props: { text: 'Nos services', level: 2 },
      },
      {
        id: 't_feat_grid',
        type: 'container',
        parentId: 't_feat_sec',
        props: { width: 'lg', layoutMode: 'grid', layoutCols: 3, layoutGap: 'md' },
      },
      {
        id: 't_feat_c1',
        type: 'card',
        parentId: 't_feat_grid',
        props: {
          title: 'Rapide',
          description: 'Une première caractéristique clé, décrite en quelques mots.',
          variant: 'bordered',
        },
      },
      {
        id: 't_feat_c2',
        type: 'card',
        parentId: 't_feat_grid',
        props: {
          title: 'Fiable',
          description: 'Une deuxième caractéristique qui rassure vos visiteurs.',
          variant: 'bordered',
        },
      },
      {
        id: 't_feat_c3',
        type: 'card',
        parentId: 't_feat_grid',
        props: {
          title: 'Simple',
          description: 'Une troisième caractéristique, claire et concise.',
          variant: 'bordered',
        },
      },
    ],
  },
  {
    id: 'cta-banner',
    name: 'Bandeau CTA',
    description: "Appel à l'action en bannière",
    blocks: [
      {
        id: 't_cta',
        type: 'cta',
        props: {
          title: 'Prêt à commencer ?',
          description: "Rejoignez-nous dès aujourd'hui, c'est gratuit.",
          text: 'Commencer maintenant',
          link: '#',
          variant: 'banner',
          buttonStyle: 'primary',
          buttonSize: 'lg',
        },
      },
    ],
  },
  {
    id: 'faq',
    name: 'FAQ',
    description: 'Questions fréquentes (accordéon)',
    blocks: [
      {
        id: 't_faq',
        type: 'faq',
        props: {
          title: 'Questions fréquentes',
          items: [
            { question: 'Première question ?', answer: 'La réponse à la première question.' },
            { question: 'Deuxième question ?', answer: 'La réponse à la deuxième question.' },
            { question: 'Troisième question ?', answer: 'La réponse à la troisième question.' },
          ],
          variant: 'bordered',
        },
      },
    ],
  },
  {
    id: 'stats-3',
    name: 'Statistiques',
    description: 'Trois chiffres clés',
    blocks: [
      {
        id: 't_stats',
        type: 'stats',
        props: {
          title: 'En chiffres',
          items: [
            { value: '10k+', label: 'Utilisateurs' },
            { value: '99%', label: 'Satisfaction' },
            { value: '24/7', label: 'Support' },
          ],
          columns: 3,
          variant: 'cards',
        },
      },
    ],
  },
  {
    id: 'testimonials',
    name: 'Témoignages',
    description: 'Deux avis clients',
    blocks: [
      {
        id: 't_test',
        type: 'testimonial',
        props: {
          title: 'Ils nous font confiance',
          items: [
            { quote: 'Un service vraiment exceptionnel, je recommande.', author: 'Marie D.', role: 'Cliente' },
            { quote: 'Simple, rapide et efficace. Parfait.', author: 'Luc V.', role: 'Client' },
          ],
          variant: 'grid',
        },
      },
    ],
  },
]
