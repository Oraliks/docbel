import React from 'react'
import { HeroProps } from '@/lib/page-builder/types'
import { sanitizeUrl } from '@/lib/page-builder/url-utils'

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export const HeroBlock: React.FC<HeroProps> = ({
  title,
  description,
  bgColor,
  image,
}) => {
  const safeBg = typeof bgColor === 'string' && HEX_COLOR.test(bgColor) ? bgColor : '#000000'
  const safeImage = sanitizeUrl(image)

  return (
    <div
      className="min-h-[400px] flex items-center justify-center p-8 rounded-lg"
      style={{ backgroundColor: safeBg }}
    >
      <div className="max-w-2xl text-center text-white">
        {safeImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safeImage}
            alt="Hero"
            className="w-full h-64 object-cover rounded-lg mb-6"
          />
        )}
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
        <p className="text-lg md:text-xl opacity-90">{description}</p>
      </div>
    </div>
  )
}
