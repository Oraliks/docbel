import React from 'react'
import { HeroProps } from '@/lib/page-builder/types'

export const HeroBlock: React.FC<HeroProps> = ({
  title,
  description,
  bgColor = '#000000',
  image,
}) => {
  return (
    <div
      className="min-h-[400px] flex items-center justify-center p-8 rounded-lg"
      style={{ backgroundColor: bgColor }}
    >
      <div className="max-w-2xl text-center text-white">
        {image && (
          // Builder hero images may use arbitrary editor-defined URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
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
