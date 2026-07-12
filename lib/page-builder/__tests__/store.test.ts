import { describe, it, expect, beforeEach } from 'vitest'
import { usePageBuilderStore, getChildrenOf, getRootBlocks } from '../store'
import type { BlockProps } from '../types'

const store = usePageBuilderStore

function state() {
  return store.getState()
}

/** Bloc « texte » fabriqué à la main (id fixe) pour les cas déterministes. */
function tb(id: string, props: Record<string, unknown> = {}, extra: Partial<BlockProps> = {}): BlockProps {
  return { id, type: 'text', props, ...extra } as unknown as BlockProps
}

beforeEach(() => {
  state().reset()
  // reset() ne remet pas styleClipboard — on le neutralise pour l'isolation.
  store.setState({ styleClipboard: null })
})

describe('CRUD de base', () => {
  it('addBlock ajoute, sélectionne et marque dirty', () => {
    const id = state().addBlock('heading')
    const s = state()
    expect(s.blocks).toHaveLength(1)
    expect(s.blocks[0].id).toBe(id)
    expect(s.selectedBlockId).toBe(id)
    expect(s.isDirty).toBe(true)
  })

  it('addBlock avec parentId + slotIndex place l’enfant dans le conteneur', () => {
    const parent = state().addBlock('columns')
    const child = state().addBlock('heading', { parentId: parent, slotIndex: 1 })
    const block = state().blocks.find((b) => b.id === child)!
    expect(block.parentId).toBe(parent)
    expect(block.slotIndex).toBe(1)
    expect(getChildrenOf(state().blocks, parent, 1)).toHaveLength(1)
  })

  it('insertAfter insère juste après le bloc cible', () => {
    const a = state().addBlock('heading')
    const b = state().addBlock('heading')
    const c = state().addBlock('heading', { insertAfter: a })
    const ids = state().blocks.map((x) => x.id)
    expect(ids).toEqual([a, c, b])
  })

  it('removeBlock retire le bloc et ses descendants', () => {
    const parent = state().addBlock('section')
    state().addBlock('heading', { parentId: parent })
    state().addBlock('text', { parentId: parent })
    expect(state().blocks).toHaveLength(3)
    state().removeBlock(parent)
    expect(state().blocks).toHaveLength(0)
    expect(state().selectedBlockId).toBeNull()
  })

  it('duplicateBlock clone le sous-arbre avec de nouveaux ids', () => {
    const parent = state().addBlock('section')
    state().addBlock('heading', { parentId: parent })
    state().duplicateBlock(parent)
    const s = state()
    expect(s.blocks).toHaveLength(4) // 2 originaux + 2 clones
    // Tous les ids sont uniques.
    const ids = s.blocks.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Le clone racine est sélectionné et a une nouvelle identité.
    expect(s.selectedBlockId).not.toBe(parent)
  })
})

describe('Réordonnancement', () => {
  it('moveBlock échange deux blocs frères', () => {
    const a = state().addBlock('heading')
    const b = state().addBlock('heading')
    state().moveBlock(b, 'up')
    expect(state().blocks.map((x) => x.id)).toEqual([b, a])
  })

  it('moveBlock ne fait rien en bord de liste', () => {
    const a = state().addBlock('heading')
    state().addBlock('heading')
    state().moveBlock(a, 'up') // a est déjà premier
    expect(state().blocks[0].id).toBe(a)
  })

  it('reorderBlocks refuse de déposer un bloc dans son propre descendant', () => {
    const parent = state().addBlock('section')
    const child = state().addBlock('heading', { parentId: parent })
    const before = state().blocks.map((b) => b.id)
    state().reorderBlocks(parent, child) // cycle interdit
    expect(state().blocks.map((b) => b.id)).toEqual(before)
  })

  it('moveToContainer reparent un bloc et empêche les cycles', () => {
    const section = state().addBlock('section')
    const orphan = state().addBlock('heading')
    state().moveToContainer(orphan, section, null)
    expect(state().blocks.find((b) => b.id === orphan)!.parentId).toBe(section)
    // Tentative de cycle : mettre la section dans son propre enfant → no-op.
    const snapshot = state().blocks.map((b) => `${b.id}:${b.parentId ?? '∅'}`)
    state().moveToContainer(section, orphan, null)
    expect(state().blocks.map((b) => `${b.id}:${b.parentId ?? '∅'}`)).toEqual(snapshot)
  })
})

describe('Sélection multiple', () => {
  it('toggleSelection ajoute puis retire un id', () => {
    const a = state().addBlock('heading')
    const b = state().addBlock('heading')
    state().selectBlock(a)
    state().toggleSelection(b)
    expect(state().selectedIds.sort()).toEqual([a, b].sort())
    state().toggleSelection(b)
    expect(state().selectedIds).toEqual([a])
  })

  it('selectMany puis clearSelection', () => {
    const a = state().addBlock('heading')
    const b = state().addBlock('heading')
    state().selectMany([a, b])
    expect(state().selectedBlockId).toBe(b) // le dernier devient primaire
    state().clearSelection()
    expect(state().selectedIds).toEqual([])
    expect(state().selectedBlockId).toBeNull()
  })
})

describe('Historique undo/redo', () => {
  it('undo annule le dernier ajout, redo le rétablit', () => {
    const a = state().addBlock('heading')
    state().addBlock('heading')
    expect(state().blocks).toHaveLength(2)
    state().undo()
    expect(state().blocks).toHaveLength(1)
    expect(state().blocks[0].id).toBe(a)
    state().redo()
    expect(state().blocks).toHaveLength(2)
  })

  it('un nouvel ajout après undo vide la pile redo', () => {
    state().addBlock('heading')
    state().addBlock('heading')
    state().undo()
    expect(state().future.length).toBeGreaterThan(0)
    state().addBlock('text')
    expect(state().future).toEqual([])
  })

  it('la pile d’historique est bornée à 80', () => {
    for (let i = 0; i < 85; i++) state().addBlock('heading')
    expect(state().past.length).toBe(80)
  })

  it('undo sans historique est un no-op', () => {
    expect(() => state().undo()).not.toThrow()
    expect(state().blocks).toEqual([])
  })
})

describe('Presse-papiers', () => {
  it('copyBlock puis pasteBlock duplique via le presse-papiers', () => {
    const a = state().addBlock('heading')
    state().copyBlock(a)
    state().pasteBlock(a)
    expect(state().blocks).toHaveLength(2)
    // Le collage a un id différent de l'original.
    expect(state().blocks[1].id).not.toBe(a)
  })

  it('cutBlock place dans le presse-papiers et retire l’original', () => {
    const a = state().addBlock('heading')
    state().cutBlock(a)
    expect(state().blocks).toHaveLength(0)
    expect(state().clipboard).not.toBeNull()
    state().pasteBlock()
    expect(state().blocks).toHaveLength(1)
  })

  it('copyBlockStyle / pasteBlockStyle recopie style + layout', () => {
    state().setBlocks([
      tb('src', {}, { style: { textColor: '#abcdef' }, layout: { paddingTop: 20 } }),
      tb('dst', {}),
    ])
    state().copyBlockStyle('src')
    state().pasteBlockStyle(['dst'])
    const dst = state().blocks.find((b) => b.id === 'dst')!
    expect(dst.style?.textColor).toBe('#abcdef')
    expect(dst.layout?.paddingTop).toBe(20)
  })
})

describe('Wrapping', () => {
  it('wrapInSection enveloppe des blocs de premier niveau', () => {
    const a = state().addBlock('heading')
    const b = state().addBlock('heading')
    state().wrapInSection([a, b])
    const s = state()
    // Un nouveau bloc section existe, a et b sont ses enfants.
    const section = s.blocks.find((x) => x.type === 'section')!
    expect(section).toBeDefined()
    expect(s.blocks.find((x) => x.id === a)!.parentId).toBe(section.id)
    expect(s.blocks.find((x) => x.id === b)!.parentId).toBe(section.id)
    expect(s.selectedBlockId).toBe(section.id)
  })
})

describe('insertTemplate', () => {
  it('remappe les ids locaux du template et sélectionne la racine', () => {
    const template: BlockProps[] = [
      tb('root'),
      tb('leaf', {}, { parentId: 'root' }),
    ]
    state().insertTemplate(template)
    const s = state()
    expect(s.blocks).toHaveLength(2)
    // Les ids d'origine ne doivent plus apparaître.
    expect(s.blocks.map((b) => b.id)).not.toContain('root')
    expect(s.blocks.map((b) => b.id)).not.toContain('leaf')
    // Le lien parent/enfant est préservé après remap.
    const root = s.blocks.find((b) => !b.parentId)!
    const leaf = s.blocks.find((b) => b.parentId)!
    expect(leaf.parentId).toBe(root.id)
    expect(s.selectedBlockId).toBe(root.id)
  })
})

describe('Find & replace (replaceText)', () => {
  it('remplace uniquement dans les clés éditoriales, pas les clés structurelles', () => {
    state().setBlocks([tb('x', { text: 'bonjour monde', link: 'bonjour.be' })])
    state().replaceText('bonjour', 'salut')
    const props = state().blocks[0].props as { text: string; link: string }
    expect(props.text).toBe('salut monde')
    expect(props.link).toBe('bonjour.be') // clé structurelle intacte
  })

  it('remplace récursivement dans des items imbriqués (question/answer)', () => {
    state().setBlocks([
      tb('faqish', { items: [{ question: 'AAA ?', answer: 'AAA oui', url: 'AAA.be' }] }),
    ])
    state().replaceText('AAA', 'BBB')
    const items = (state().blocks[0].props as { items: Array<Record<string, string>> }).items
    expect(items[0].question).toBe('BBB ?')
    expect(items[0].answer).toBe('BBB oui')
    expect(items[0].url).toBe('AAA.be') // url non éditorial
  })

  it('ne pollue pas l’historique quand rien ne correspond', () => {
    state().setBlocks([tb('x', { text: 'rien' })])
    const pastLen = state().past.length
    state().replaceText('zzz', 'yyy')
    expect(state().past.length).toBe(pastLen)
  })

  it('no-op quand la chaîne recherchée est vide', () => {
    state().setBlocks([tb('x', { text: 'garde' })])
    const before = state().blocks[0].props
    state().replaceText('', 'x')
    expect(state().blocks[0].props).toBe(before)
  })
})

describe('Mises à jour par couche', () => {
  it('updateBlockProps fusionne les props', () => {
    const a = state().addBlock('heading')
    state().updateBlockProps(a, { text: 'Nouveau titre' })
    expect((state().blocks[0].props as { text: string }).text).toBe('Nouveau titre')
  })

  it('updateBlockStyle et updateBlockLayout fusionnent sans écraser', () => {
    const a = state().addBlock('heading')
    state().updateBlockStyle(a, { textColor: '#111111' })
    state().updateBlockStyle(a, { fontSize: 24 })
    const block = state().blocks[0]
    expect(block.style?.textColor).toBe('#111111')
    expect(block.style?.fontSize).toBe(24)
  })

  it('updateBlockResponsive fusionne les surcharges par device', () => {
    const a = state().addBlock('heading')
    state().updateBlockResponsive(a, 'mobile', { style: { fontSize: 12 } })
    state().updateBlockResponsive(a, 'mobile', { layout: { paddingTop: 4 } })
    const r = state().blocks[0].responsive?.mobile
    expect(r?.style?.fontSize).toBe(12)
    expect(r?.layout?.paddingTop).toBe(4)
  })

  it('updateBlockLayoutLive ne pousse PAS d’historique', () => {
    const a = state().addBlock('heading')
    const pastLen = state().past.length
    state().updateBlockLayoutLive(a, { left: 42 })
    expect(state().past.length).toBe(pastLen)
    expect(state().blocks[0].layout?.left).toBe(42)
  })
})

describe('Helpers', () => {
  it('getRootBlocks ne renvoie que les blocs de premier niveau', () => {
    const parent = state().addBlock('section')
    state().addBlock('heading', { parentId: parent })
    expect(getRootBlocks(state().blocks).map((b) => b.id)).toEqual([parent])
  })
})
