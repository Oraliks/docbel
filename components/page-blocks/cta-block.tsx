import React from 'react'
import { Button } from '@/components/ui/button'
import { CtaProps } from '@/lib/page-builder/types'
import { sanitizeLink } from '@/lib/page-builder/url-utils'

export const CtaBlock: React.FC<CtaProps & { isEditable?: boolean }> = ({
  text,
  link,
  variant = 'primary',
  isEditable = false,
}) => {
  const safeLink = sanitizeLink(link)
  const isExternal = /^https?:\/\//i.test(safeLink)

  return (
    <div className="flex justify-center py-12">
      {isEditable ? (
        <Button
          variant={variant === 'primary' ? 'default' : 'outline'}
          size="lg"
          disabled
        >
          {text}
        </Button>
      ) : (
        <a
          href={safeLink}
          className="no-underline"
          rel={isExternal ? 'noopener noreferrer' : undefined}
          target={isExternal ? '_blank' : undefined}
        >
          <Button
            variant={variant === 'primary' ? 'default' : 'outline'}
            size="lg"
          >
            {text}
          </Button>
        </a>
      )}
    </div>
  )
}
