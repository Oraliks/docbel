'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const PageEditorClient = dynamic(() => import('./page-editor-client'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen flex-col bg-background">
      <div className="border-b bg-card p-3">
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Skeleton className="w-60 border-r" />
        <div className="flex-1 p-8 space-y-3">
          <Skeleton className="h-24 w-full max-w-3xl mx-auto" />
          <Skeleton className="h-32 w-full max-w-3xl mx-auto" />
          <Skeleton className="h-24 w-full max-w-3xl mx-auto" />
        </div>
        <Skeleton className="w-[340px] border-l" />
      </div>
    </div>
  ),
})

export default function PageEditorPage({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  return <PageEditorClient params={params} />
}
