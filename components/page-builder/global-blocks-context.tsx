'use client'

import React from 'react'
import type { BlockProps } from '@/lib/page-builder/types'

/** Map of GlobalBlock id → its resolved block content. */
export type GlobalBlocksMap = Record<string, BlockProps>

const GlobalBlocksContext = React.createContext<GlobalBlocksMap>({})

export function GlobalBlocksProvider({
  value,
  children,
}: {
  value: GlobalBlocksMap
  children: React.ReactNode
}) {
  return (
    <GlobalBlocksContext.Provider value={value}>
      {children}
    </GlobalBlocksContext.Provider>
  )
}

export function useGlobalBlocks(): GlobalBlocksMap {
  return React.useContext(GlobalBlocksContext)
}
