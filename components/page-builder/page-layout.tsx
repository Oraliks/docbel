'use client'

import React, { useState } from 'react'
import { Sidebar } from '@/components/docbel/sidebar'
import { Footer } from '@/components/docbel/footer'
import { PageRenderer } from './page-renderer'
import { BlockProps } from '@/lib/page-builder/types'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

interface PageLayoutProps {
  blocks: BlockProps[]
  title: string
}

export function PageLayout({ blocks, title }: PageLayoutProps) {
  const [dark, setDark] = useState(false)
  const [lang, setLang] = useState('FR')
  const [outilsOpen, setOutilsOpen] = useState(false)
  const [activePage, setActivePage] = useState('accueil')

  const accent = '#C8102E'

  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          '--sidebar-width': '18rem',
          '--sidebar-width-mobile': '20rem',
        } as React.CSSProperties
      }
    >
      <Sidebar
        accent={accent}
        dark={dark}
        setDark={setDark}
        lang={lang}
        setLang={setLang}
        activePage={activePage}
        setActivePage={setActivePage}
        userLoggedIn={false}
        setShowLoginModal={() => {}}
        outilsOpen={outilsOpen}
        setOutilsOpen={setOutilsOpen}
        width={260}
        toolsCat="Tous"
        setToolsCat={() => {}}
      />

      <SidebarInset className="min-h-screen">
        <div className="flex flex-1 flex-col">
          <div className="border-b bg-background px-8 py-6">
            <h1 className="m-0 text-2xl font-bold text-foreground">
              {title}
            </h1>
          </div>

          <main className="flex-1 bg-background">
            <div className="mx-auto max-w-7xl px-4 py-12">
              <PageRenderer blocks={blocks} />
            </div>
          </main>

          <Footer />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
