import React from 'react'
import { Button } from '@/components/ui/button'
import { CtaProps } from '@/lib/page-builder/types'

export const CtaBlock: React.FC<CtaProps & { isEditable?: boolean }> = ({
  text,
  link,
  variant = 'primary',
  isEditable = false
}) => {
  return (
    <div className="flex justify-center py-12">
      {isEditable ? (
        <Button
          variant={variant === 'primary' ? 'default' : 'outline'}
          size="lg"
          className={variant === 'primary' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          disabled
        >
          {text}
        </Button>
      ) : (
        <a href={link} className="no-underline" onClick={(e) => {
          // Prevent navigation in page builder
          if (typeof window !== 'undefined' && window.location.pathname.includes('/admin/pages')) {
            e.preventDefault()
          }
        }}>
          <Button
            variant={variant === 'primary' ? 'default' : 'outline'}
            size="lg"
            className={variant === 'primary' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            {text}
          </Button>
        </a>
      )}
    </div>
  )
}
