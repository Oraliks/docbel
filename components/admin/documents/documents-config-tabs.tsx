'use client'

import { type ComponentProps } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Building2, Package } from 'lucide-react'
import { OrganismesAdmin } from './organismes-admin'
import { BundlesList } from './bundles-list'

const TABS = ['organismes', 'bundles'] as const
type TabValue = (typeof TABS)[number]

function isTab(v: string | null | undefined): v is TabValue {
  return !!v && (TABS as readonly string[]).includes(v)
}

interface Props {
  organismes: ComponentProps<typeof OrganismesAdmin>['initial']
  bundles: ComponentProps<typeof BundlesList>['initialBundles']
}

export function DocumentsConfigTabs({ organismes, bundles }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const raw = params?.get('tab')
  // Bundles est l'onglet principal — c'est le cœur de l'usage admin.
  const tab: TabValue = isTab(raw) ? raw : 'bundles'

  const setTab = (next: TabValue) => {
    const usp = new URLSearchParams(params?.toString() ?? '')
    if (next === 'bundles') usp.delete('tab')
    else usp.set('tab', next)
    router.replace(usp.toString() ? `?${usp.toString()}` : '?', { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Configurations documents</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Référentiels partagés : organismes émetteurs et bundles
          d&apos;événements de vie. Les presets de validation pour les PDF
          AcroForm sont gérés depuis « PDF Forms → Presets de champs ».
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab((v ?? 'bundles') as TabValue)}>
        <TabsList variant="line" className="flex w-full justify-start gap-1">
          <TabsTrigger value="bundles" className="gap-1.5">
            <Package className="w-3.5 h-3.5" /> Bundles ({bundles.length})
          </TabsTrigger>
          <TabsTrigger value="organismes" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Organismes ({organismes.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'organismes' && <OrganismesAdmin initial={organismes} />}
      {tab === 'bundles' && <BundlesList initialBundles={bundles} />}
    </div>
  )
}
