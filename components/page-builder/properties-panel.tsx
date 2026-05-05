'use client'

import React from 'react'
import { BlockProps } from '@/lib/page-builder/types'
import { BLOCK_REGISTRY } from '@/lib/page-builder/block-registry'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface PropertiesPanelProps {
  block: BlockProps
  onChange: (props: Record<string, unknown>) => void
}

export function PropertiesPanel({ block, onChange }: PropertiesPanelProps) {
  const config = BLOCK_REGISTRY[block.type]

  const handleChange = (key: string, value: unknown) => {
    onChange({ [key]: value })
  }

  return (
    <div className="w-72 border-l bg-card overflow-y-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{config.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {config.description}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Object.entries(block.props).map(([key, value]) => (
          <div key={key} className="space-y-2">
            <Label className="text-xs font-medium capitalize">{key}</Label>
            {typeof value === 'string' && key.includes('http') ? (
              <Input
                type="url"
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="h-8 text-xs"
              />
            ) : typeof value === 'string' && (key === 'content' || key === 'description') ? (
              <Textarea
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="h-20 text-xs"
              />
            ) : typeof value === 'string' ? (
              <Input
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="h-8 text-xs"
              />
            ) : typeof value === 'number' ? (
              <Input
                type="number"
                value={value}
                onChange={(e) => handleChange(key, Number(e.target.value))}
                className="h-8 text-xs"
              />
            ) : typeof value === 'boolean' ? (
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => handleChange(key, e.target.checked)}
                className="h-4 w-4"
              />
            ) : Array.isArray(value) ? (
              <div className="text-xs text-muted-foreground">Array ({value.length} items)</div>
            ) : (
              <div className="text-xs text-muted-foreground">Object</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
