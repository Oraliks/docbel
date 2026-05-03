import React from 'react'
import { ImageProps } from '@/lib/page-builder/types'

export const ImageBlock: React.FC<ImageProps> = ({ url, alt, caption, width = '100%', height = 'auto' }) => {
  if (!url) {
    return (
      <div className="bg-gray-100 rounded-lg p-12 text-center text-gray-500">
        <p className="text-sm">Image non configurée</p>
      </div>
    )
  }

  return (
    <figure className="my-8">
      <img
        src={url}
        alt={alt}
        style={{
          width: typeof width === 'string' && width.includes('%') ? width : 'auto',
          height,
          maxWidth: '100%',
          borderRadius: '8px',
        }}
        className="shadow-sm"
      />
      {caption && <figcaption className="text-sm text-gray-600 text-center mt-3">{caption}</figcaption>}
    </figure>
  )
}
