'use client'

import React, { useState } from 'react'
import { Sidebar } from '@/components/docbel/sidebar'
import { Footer } from '@/components/docbel/footer'
import { PageRenderer } from './page-renderer'
import { BlockProps } from '@/lib/page-builder/types'

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
    <div
      className="flex bg-background text-foreground min-h-screen"
    >
      {/* Sidebar */}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Page Header */}
        <div className="px-8 py-6 border-b border-border bg-surface">
          <h1 className="text-2xl font-bold text-foreground m-0">
            {title}
          </h1>
        </div>

        {/* Page Content */}
        <main className="flex-1">
          <div className="bg-surface">
            <div className="max-w-7xl mx-auto py-12 px-4">
              <PageRenderer blocks={blocks} />
            </div>
          </div>
        </main>

        {/* Footer */}
        <Footer accent={accent} />
      </div>
    </div>
  )
}
