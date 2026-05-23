'use client'

import { type ComponentProps } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LayoutGrid, Building2, ShieldCheck, Package } from 'lucide-react'
import { SectionsAdmin } from './sections-admin'
import { OrganismesAdmin } from './organismes-admin'
import { PresetsAdmin } from './presets-admin'
import { BundlesList } from './bundles-list'

const TABS = ['sections', 'organismes', 'presets', 'bundles'] as const
type TabValue = (typeof TABS)[number]

function isTab(v: string | null | undefined): v is TabValue {
  return !!v && (TABS as readonly string[]).includes(v)
}

interface Props {
  sections: ComponentProps<typeof SectionsAdmin>['initial']
  organismes: ComponentProps<typeof OrganismesAdmin>['initial']
  presets: ComponentProps<typeof PresetsAdmin>['initial']
  bundles: ComponentProps<typeof BundlesList>['initialBundles']
}

export function DocumentsConfigTabs({ sections, organismes, presets, bundles }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const raw = params?.get('tab')
  const tab: TabValue = isTab(raw) ? raw : 'sections'

  const setTab = (next: TabValue) => {
    const usp = new URLSearchParams(params?.toString() ?? '')
    if (next === 'sections') usp.delete('tab')
    else usp.set('tab', next)
    router.replace(usp.toString() ? `?${usp.toString()}` : '?', { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Configurations documents</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Référentiels partagés par tous les modèles : sections d&apos;outils, organismes émetteurs,
          presets de validation, bundles d&apos;événements de vie.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab((v ?? 'sections') as TabValue)}>
        <TabsList variant="line" className="flex w-full justify-start gap-1">
          <TabsTrigger value="sections" className="gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5" /> Sections ({sections.length})
          </TabsTrigger>
          <TabsTrigger value="organismes" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Organismes ({organismes.length})
          </TabsTrigger>
          <TabsTrigger value="presets" className="gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Presets validation ({presets.length})
          </TabsTrigger>
          <TabsTrigger value="bundles" className="gap-1.5">
            <Package className="w-3.5 h-3.5" /> Bundles ({bundles.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'sections' && <SectionsAdmin initial={sections} />}
      {tab === 'organismes' && <OrganismesAdmin initial={organismes} />}
      {tab === 'presets' && <PresetsAdmin initial={presets} />}
      {tab === 'bundles' && <BundlesList initialBundles={bundles} />}
    </div>
  )
}
