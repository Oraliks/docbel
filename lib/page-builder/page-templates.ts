import { BlockProps } from './types'
import { nanoid } from 'nanoid'

export interface PageTemplate {
  id: string
  name: string
  description: string
  thumbnail?: string
  blocks: BlockProps[]
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'blank',
    name: 'Vierge',
    description: 'Commencer avec une page vide',
    blocks: [],
  },
  {
    id: 'landing-hero',
    name: 'Page d\'accueil',
    description: 'Hero + Contenu + CTA',
    blocks: [
      {
        id: nanoid(),
        type: 'hero',
        props: {
          title: 'Bienvenue sur notre page',
          description: 'Une description courte et engageante',
          bgColor: '#C8102E',
          image: '',
        },
      },
      {
        id: nanoid(),
        type: 'cta',
        props: {
          text: 'En savoir plus',
          link: '#',
          variant: 'primary',
        },
      },
    ],
  },
  {
    id: 'features-page',
    name: 'Page de fonctionnalités',
    description: 'Hero + Fonctionnalités + CTA',
    blocks: [
      {
        id: nanoid(),
        type: 'hero',
        props: {
          title: 'Nos fonctionnalités',
          description: 'Découvrez ce que nous proposons',
          bgColor: '#2C3E50',
          image: '',
        },
      },
      {
        id: nanoid(),
        type: 'features',
        props: {
          title: 'Avantages clés',
          items: [
            {
              icon: '⚡',
              title: 'Rapide',
              description: 'Performance optimale et chargement instantané',
            },
            {
              icon: '🔒',
              title: 'Sécurisé',
              description: 'Données protégées avec les dernières normes',
            },
            {
              icon: '📱',
              title: 'Responsive',
              description: 'Fonctionne sur tous les appareils',
            },
          ],
        },
      },
      {
        id: nanoid(),
        type: 'cta',
        props: {
          text: 'Commencer maintenant',
          link: '#',
          variant: 'primary',
        },
      },
    ],
  },
  {
    id: 'blog-post',
    name: 'Article de blog',
    description: 'Titre + Contenu détaillé + CTA',
    blocks: [
      {
        id: nanoid(),
        type: 'section',
        props: {
          title: 'Titre de l\'article',
          description: 'Sous-titre ou résumé',
          bgColor: '#FFFFFF',
          padding: 'large',
        },
      },
      {
        id: nanoid(),
        type: 'cta',
        props: {
          text: 'Partager cet article',
          link: '#',
          variant: 'secondary',
        },
      },
    ],
  },
  {
    id: 'contact-form',
    name: 'Page de contact',
    description: 'Titre + Formulaire + Infos',
    blocks: [
      {
        id: nanoid(),
        type: 'hero',
        props: {
          title: 'Nous contacter',
          description: 'Nous serions heureux d\'entendre parler de vous',
          bgColor: '#34495E',
          image: '',
        },
      },
    ],
  },
]

export function getTemplateById(id: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.id === id)
}

export function getTemplateBlocks(id: string): BlockProps[] {
  const template = getTemplateById(id)
  if (!template) return []

  // Generate new IDs for blocks to avoid conflicts
  return template.blocks.map((block) => ({
    ...block,
    id: nanoid(),
    props: { ...block.props },
  })) as BlockProps[]
}
