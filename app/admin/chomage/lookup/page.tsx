'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Database,
  Search,
  BarChart3,
  AlertTriangle,
  Upload,
  ExternalLink,
} from 'lucide-react'
import { LookupTablesView } from '@/components/admin/lookup/lookup-tables-view'
import { LookupSearchView } from '@/components/admin/lookup/lookup-search-view'
import { LookupStatsView } from '@/components/admin/lookup/lookup-stats-view'
import { LookupAnomaliesView } from '@/components/admin/lookup/lookup-anomalies-view'
import { LookupImportBatchView } from '@/components/admin/lookup/lookup-import-batch-view'

const TABS = ['tables', 'search', 'stats', 'anomalies', 'import'] as const
type TabValue = (typeof TABS)[number]

function isTabValue(v: string | null | undefined): v is TabValue {
  return !!v && (TABS as readonly string[]).includes(v)
}

export default function LookupAdminPage() {
  const router = useRouter()
  const params = useSearchParams()
  const raw = params?.get('tab')
  const tab: TabValue = isTabValue(raw) ? raw : 'tables'

  const setTab = (next: TabValue) => {
    const usp = new URLSearchParams(params?.toString() ?? '')
    if (next === 'tables') usp.delete('tab')
    else usp.set('tab', next)
    // Reset des params spécifiques aux autres tabs pour éviter la pollution.
    if (next !== 'search') {
      usp.delete('q')
      usp.delete('cat')
      usp.delete('lang')
    }
    router.replace(usp.toString() ? `?${usp.toString()}` : '?', { scroll: false })
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lookup ONEM</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Référentiel local des codes ONEM · 90+ tables · 11 000+ entrées
          </p>
        </div>
        <a
          href="https://services.onem.be/lookupweb/"
          target="_blank"
          rel="noreferrer"
        >
          <Button variant="outline" size="sm">
            services.onem.be/lookupweb
            <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </a>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab((v ?? 'tables') as TabValue)}>
        <TabsList variant="line" className="flex w-full justify-start gap-1">
          <TabsTrigger value="tables" className="gap-1.5">
            <Database className="w-3.5 h-3.5" /> Tables
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5">
            <Search className="w-3.5 h-3.5" /> Recherche
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Statistiques
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Anomalies
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Import en lot
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Conditional render : seul l'onglet actif déclenche ses fetchs API. */}
      {tab === 'tables' && <LookupTablesView />}
      {tab === 'search' && <LookupSearchView />}
      {tab === 'stats' && <LookupStatsView />}
      {tab === 'anomalies' && <LookupAnomaliesView />}
      {tab === 'import' && <LookupImportBatchView />}
    </div>
  )
}
