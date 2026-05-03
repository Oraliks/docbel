'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Menu, LayoutDashboard, FileText, LogOut, Settings } from 'lucide-react'

interface AdminSidebarMiniProps {
  isOpen: boolean
  onToggle: (open: boolean) => void
}

export const AdminSidebarMini: React.FC<AdminSidebarMiniProps> = ({ isOpen, onToggle }) => {
  const items = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
    { icon: FileText, label: 'Builder', href: '/admin/pages', active: true },
    { icon: Settings, label: 'Paramètres', href: '#' },
    { icon: LogOut, label: 'Quitter', href: '/' },
  ]

  return (
    <div className={`fixed left-0 top-0 h-screen bg-white border-r flex flex-col items-center gap-2 p-2 transition-all ${
      isOpen ? 'w-16' : 'w-16'
    }`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onToggle(!isOpen)}
        className="w-12 h-12"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1 flex flex-col gap-2">
        {items.map((item) => (
          <a key={item.label} href={item.href} className="group/nav relative">
            <Button
              variant={item.active ? 'default' : 'ghost'}
              size="icon"
              className="w-12 h-12"
              title={item.label}
            >
              <item.icon className="h-5 w-5" />
            </Button>
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover/nav:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
              {item.label}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
