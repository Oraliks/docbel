'use client'

import { BLOCK_REGISTRY, BLOCK_CATEGORIES, BlockCategory } from '@/lib/page-builder/block-registry'
import { BlockType } from '@/lib/page-builder/types'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface SidebarBlocksProps {
  onAddBlock: (type: BlockType) => void
}

export function SidebarBlocks({ onAddBlock }: SidebarBlocksProps) {
  const categories: BlockCategory[] = ['structure', 'interaction', 'contenu']

  return (
    <div className="w-64 border-r bg-card overflow-y-auto">
      {categories.map((cat) => {
        const blocks = Object.entries(BLOCK_REGISTRY)
          .filter(([, cfg]) => cfg.category === cat)
          .map(([type]) => type as BlockType)

        if (blocks.length === 0) return null

        return (
          <div key={cat} className="p-4 border-b">
            <h3 className="font-semibold text-sm mb-3">{BLOCK_CATEGORIES[cat]}</h3>
            <div className="space-y-2">
              {blocks.map((type) => {
                const cfg = BLOCK_REGISTRY[type]
                return (
                  <Button
                    key={type}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => onAddBlock(type)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    <div className="text-left flex-1">
                      <div className="text-xs font-medium">{cfg.name}</div>
                      <div className="text-xs text-muted-foreground">{cfg.description}</div>
                    </div>
                  </Button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
