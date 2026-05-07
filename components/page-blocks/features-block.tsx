import React from 'react'
import { FeaturesProps } from '@/lib/page-builder/types'

export const FeaturesBlock: React.FC<FeaturesProps> = ({ title, items = [] }) => {
  return (
    <div className="py-12">
      {title && <h2 className="text-3xl font-bold mb-8 text-center">{title}</h2>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {items.map((item, idx) => (
          <div key={idx} className="text-center p-6 rounded-lg border border-border bg-card hover:shadow-lg transition">
            {item.icon && <div className="text-4xl mb-3">{item.icon}</div>}
            <h3 className="text-lg font-semibold mb-2 text-card-foreground">{item.title}</h3>
            <p className="text-muted-foreground text-sm">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
