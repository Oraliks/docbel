'use client'

import React from 'react'
import {
  BlockProps,
  CtaProps,
  FeaturesProps,
  HeroProps,
  ImageProps,
  SectionProps,
} from '@/lib/page-builder/types'
import { BLOCK_REGISTRY } from '@/lib/page-builder/block-registry'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HeroSettings } from './block-settings/hero-settings'
import { CtaSettings } from './block-settings/cta-settings'
import { ImageSettings } from './block-settings/image-settings'
import { FeaturesSettings } from './block-settings/features-settings'
import { SectionSettings } from './block-settings/section-settings'

interface PropertiesPanelProps {
  block: BlockProps
  onChange: (props: Record<string, unknown>) => void
}

function BlockSettings({ block, onChange }: PropertiesPanelProps) {
  switch (block.type) {
    case 'hero':
      return (
        <HeroSettings
          value={block.props}
          onChange={(v: HeroProps) => onChange(v as unknown as Record<string, unknown>)}
        />
      )
    case 'cta':
      return (
        <CtaSettings
          value={block.props}
          onChange={(v: CtaProps) => onChange(v as unknown as Record<string, unknown>)}
        />
      )
    case 'image':
      return (
        <ImageSettings
          value={block.props}
          onChange={(v: ImageProps) => onChange(v as unknown as Record<string, unknown>)}
        />
      )
    case 'features':
      return (
        <FeaturesSettings
          value={block.props}
          onChange={(v: FeaturesProps) => onChange(v as unknown as Record<string, unknown>)}
        />
      )
    case 'section':
      return (
        <SectionSettings
          value={block.props}
          onChange={(v: SectionProps) => onChange(v as unknown as Record<string, unknown>)}
        />
      )
    default:
      return null
  }
}

export const PropertiesPanel = React.memo(function PropertiesPanel({
  block,
  onChange,
}: PropertiesPanelProps) {
  const config = BLOCK_REGISTRY[block.type]

  return (
    <div className="w-80 border-l bg-card overflow-y-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{config.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {config.description}
        </CardContent>
      </Card>

      <BlockSettings block={block} onChange={onChange} />
    </div>
  )
})
