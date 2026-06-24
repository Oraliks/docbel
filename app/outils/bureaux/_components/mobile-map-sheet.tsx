'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Map } from 'lucide-react'
import { CommunePanel } from './commune-panel'
import type { BureauResult, CommuneSummary } from './types'

interface Props {
  commune: CommuneSummary | null
  bureaux: (BureauResult | null)[]
}

/**
 * En mobile : la map dans un Sheet plein-écran déclenché par un bouton.
 * Inutile d'occuper la moitié de l'écran avec une map non interactive
 * scrollante. Sur desktop ce composant est masqué (CSS).
 */
export function MobileMapSheet({ commune, bureaux }: Props) {
  const t = useTranslations('public.outils')
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="lg:hidden gap-1.5 w-full">
            <Map className="w-3.5 h-3.5" />
            {t('mobileSheetTrigger')}
          </Button>
        }
      />
      <SheetContent
        side="bottom"
        className="h-[85vh] flex flex-col p-0"
      >
        <SheetHeader className="p-4 pb-2 shrink-0">
          <SheetTitle>{t('mobileSheetTitle')}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto p-4 pt-0">
          <CommunePanel commune={commune} bureaux={bureaux} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
