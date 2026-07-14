// app/outils/bureaux/_components/type-icon.tsx
'use client'
import { Landmark, HeartHandshake, Building2, Briefcase, Wallet, Users } from 'lucide-react'

const MAP = { Landmark, HeartHandshake, Building2, Briefcase, Wallet, Users } as const

export function TypeIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = MAP[name as keyof typeof MAP] ?? Building2
  return <Cmp className={className} aria-hidden />
}
