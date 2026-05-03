import { BlockType } from './types'

export type BlockCategory = 'structure' | 'interaction' | 'contenu'

export const BLOCK_CATEGORIES: Record<BlockCategory, string> = {
  structure: 'Structure',
  interaction: 'Interaction',
  contenu: 'Contenu'
}

export const BLOCK_REGISTRY: Record<
  BlockType,
  {
    name: string
    description: string
    defaultProps: Record<string, any>
    iconName: string
    category: BlockCategory
  }
> = {
  hero: {
    name: 'Hero',
    description: 'Bannière avec titre et description',
    category: 'structure',
    defaultProps: {
      title: 'Titre du héros',
      description: 'Description courte',
      bgColor: '#000000',
      image: '',
    },
    iconName: 'zap',
  },
  cta: {
    name: 'Bouton',
    description: 'Bouton avec lien',
    category: 'interaction',
    defaultProps: {
      text: 'Cliquer',
      link: '#',
      variant: 'primary',
    },
    iconName: 'mouse-pointer',
  },
  image: {
    name: 'Image',
    description: 'Afficher une image',
    category: 'contenu',
    defaultProps: {
      url: '',
      alt: 'Description',
      caption: '',
      width: '100%',
      height: 'auto',
    },
    iconName: 'file-text',
  },
  features: {
    name: 'Fonctionnalités',
    description: 'Grille de fonctionnalités/avantages',
    category: 'contenu',
    defaultProps: {
      title: 'Nos fonctionnalités',
      items: [
        { icon: '⚡', title: 'Rapide', description: 'Performance optimale' },
        { icon: '🔒', title: 'Sécurisé', description: 'Données protégées' },
        { icon: '📱', title: 'Responsive', description: 'Sur tous les appareils' },
      ],
    },
    iconName: 'zap',
  },
  section: {
    name: 'Section',
    description: 'Conteneur avec fond personnalisé',
    category: 'structure',
    defaultProps: {
      title: '',
      description: '',
      bgColor: '#f5f5f5',
      padding: 'large',
    },
    iconName: 'file-text',
  },
}
