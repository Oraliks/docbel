import React from 'react'
import { SectionProps } from '@/lib/page-builder/types'

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

const paddingMap = {
  small: '16px',
  medium: '32px',
  large: '48px',
} as const

export const SectionBlock: React.FC<SectionProps> = ({
  title,
  description,
  bgColor,
  padding = 'large',
}) => {
  const safeBg = typeof bgColor === 'string' && HEX_COLOR.test(bgColor) ? bgColor : '#f5f5f5'
  const paddingValue = paddingMap[padding] ?? paddingMap.large

  return (
    <div
      style={{
        backgroundColor: safeBg,
        padding: paddingValue,
        borderRadius: '8px',
      }}
      className="my-8"
    >
      {title && <h2 className="text-2xl font-bold mb-4 text-neutral-900">{title}</h2>}
      {description && <p className="text-neutral-700 leading-relaxed whitespace-pre-line">{description}</p>}
    </div>
  )
}
