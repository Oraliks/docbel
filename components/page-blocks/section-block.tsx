import React from 'react'
import { SectionProps } from '@/lib/page-builder/types'

const paddingMap = {
  small: '16px',
  medium: '32px',
  large: '48px',
}

export const SectionBlock: React.FC<SectionProps> = ({
  title,
  description,
  bgColor = '#f5f5f5',
  padding = 'large',
}) => {
  const paddingValue = paddingMap[padding]

  return (
    <div
      style={{
        backgroundColor: bgColor,
        padding: paddingValue,
        borderRadius: '8px',
      }}
      className="my-8"
    >
      {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
      {description && <p className="text-gray-700 leading-relaxed">{description}</p>}
    </div>
  )
}
