import React from 'react'
import { ImageProps } from '@/lib/page-builder/types'
import { sanitizeUrl } from '@/lib/page-builder/url-utils'

export const ImageBlock: React.FC<ImageProps> = ({
  url,
  alt,
  caption,
  width = '100%',
  height = 'auto',
}) => {
  const safeUrl = sanitizeUrl(url)

  if (!safeUrl) {
    return (
      <div className="bg-muted rounded-lg p-12 text-center text-muted-foreground">
        <p className="text-sm">Image non configurée</p>
      </div>
    )
  }

  return (
    <figure className="my-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={safeUrl}
        alt={alt}
        style={{
          width: typeof width === 'string' && width.includes('%') ? width : 'auto',
          height,
          maxWidth: '100%',
          borderRadius: '8px',
        }}
        className="shadow-sm"
      />
      {caption && <figcaption className="text-sm text-muted-foreground text-center mt-3">{caption}</figcaption>}
    </figure>
  )
}
