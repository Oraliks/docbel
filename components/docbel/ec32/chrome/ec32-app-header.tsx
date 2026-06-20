'use client'

// =====================================================================
//  eC3.2 — En-tête « chrome » pédagogique
// ---------------------------------------------------------------------
//  Reproduit visuellement la barre supérieure de l'appli eC3.2 (façon
//  glass Docbel) avec menu Home, menu Plus, menu Langue et menu Dossier
//  personnel. Aucun logo officiel, libellés en français.
// =====================================================================

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  ChevronDown,
  Globe,
  Home,
  LogOut,
  MoreHorizontal,
  Settings2,
  ShieldCheck,
  UserCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─────────────────────────── Types ───────────────────────────

export type Ec32HeaderLanguage = 'nl' | 'fr' | 'de'

export interface Ec32AppHeaderProps {
  /** Nom affiché dans le menu Dossier personnel (défaut « Citoyen·ne »). */
  userName?: string
  /** Clic sur le bouton Home. */
  onHome?: () => void
  /** Sélection d'une entrée du menu « Plus ». */
  onMoreSelect?: (item: string) => void
  /** Changement de langue. */
  onLanguage?: (lang: Ec32HeaderLanguage) => void
  /** Demande d'accès au dossier d'une autre personne. */
  onRequestAccess?: () => void
  /** Gestion des accès délégués. */
  onManageAccess?: () => void
  /** Déconnexion. */
  onLogout?: () => void
}

// ─────────────────────────── Sous-composants internes ───────────────────────────

type MenuKey = 'more' | 'language' | 'user' | null

interface DropdownButtonProps {
  open: boolean
  onToggle: () => void
  ariaLabel: string
  children: React.ReactNode
  className?: string
}

function DropdownButton({ open, onToggle, ariaLabel, children, className }: DropdownButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={ariaLabel}
      onClick={onToggle}
      className={cn('gap-1.5 text-foreground/80 hover:text-foreground', className)}
    >
      {children}
    </Button>
  )
}

function DropdownPanel({
  open,
  labelledBy,
  children,
  align = 'right',
}: {
  open: boolean
  labelledBy?: string
  children: React.ReactNode
  align?: 'right' | 'left'
}) {
  if (!open) return null
  return (
    <div
      role="menu"
      aria-labelledby={labelledBy}
      className={cn(
        'absolute z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-primary/15 bg-popover p-1.5 shadow-[0_2px_8px_rgba(26,26,36,0.08),0_24px_48px_-24px_rgba(91,70,229,0.35)]',
        align === 'right' ? 'right-0' : 'left-0',
      )}
    >
      {children}
    </div>
  )
}

function MenuItem({
  onSelect,
  active,
  icon: Icon,
  children,
}: {
  onSelect?: () => void
  active?: boolean
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors',
        'text-foreground/85 hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:text-primary focus-visible:outline-none',
        active && 'bg-primary/10 text-primary',
      )}
    >
      {Icon && <Icon className="size-4 shrink-0 opacity-80" aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {active && (
        <span aria-hidden className="ml-auto size-1.5 rounded-full bg-primary" />
      )}
    </button>
  )
}

// ─────────────────────────── Composant principal ───────────────────────────

export function Ec32AppHeader({
  userName = 'Citoyen·ne',
  onHome,
  onMoreSelect,
  onLanguage,
  onRequestAccess,
  onManageAccess,
  onLogout,
}: Ec32AppHeaderProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const uid = useId()

  // Fermeture sur clic extérieur + touche Escape.
  useEffect(() => {
    if (openMenu === null) return
    const handlePointer = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (event.target instanceof Node && rootRef.current.contains(event.target)) return
      setOpenMenu(null)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [openMenu])

  const toggleMenu = useCallback((key: Exclude<MenuKey, null>) => {
    setOpenMenu(current => (current === key ? null : key))
  }, [])

  const handleMore = (item: string) => {
    setOpenMenu(null)
    onMoreSelect?.(item)
  }

  const handleLanguage = (lang: Ec32HeaderLanguage) => {
    setOpenMenu(null)
    onLanguage?.(lang)
  }

  const handleUser = (action: () => void | undefined) => {
    setOpenMenu(null)
    action()
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        'sticky top-3 z-40 mx-auto flex w-full items-center justify-between gap-3',
        'rounded-2xl border border-primary/15 bg-card/85 px-4 py-2.5 backdrop-blur-xl',
        'shadow-[0_1px_3px_rgba(26,26,36,0.05),0_16px_38px_-22px_rgba(91,70,229,0.24)]',
      )}
    >
      {/* Bloc gauche — libellé texte (jamais de logo officiel). */}
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[0.7rem] font-bold text-primary"
        >
          eC
        </span>
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">
          eC3.2
          <span className="mx-2 text-foreground/30">·</span>
          <span className="font-medium text-foreground/75">
            Carte de contrôle chômage temporaire
          </span>
        </p>
      </div>

      {/* Bloc droit — navigation. */}
      <nav className="flex items-center gap-1" aria-label="Navigation principale">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Accueil"
          onClick={onHome}
          className="text-foreground/80 hover:text-foreground"
        >
          <Home className="size-4" aria-hidden />
        </Button>

        {/* Menu « Plus ». */}
        <div className="relative">
          <DropdownButton
            open={openMenu === 'more'}
            onToggle={() => toggleMenu('more')}
            ariaLabel="Plus d'options"
          >
            <MoreHorizontal className="size-4" aria-hidden />
            <span className="hidden sm:inline">Plus</span>
            <ChevronDown className="size-3 opacity-70" aria-hidden />
          </DropdownButton>
          <DropdownPanel open={openMenu === 'more'} labelledBy={`${uid}-more`}>
            <MenuItem onSelect={() => handleMore('Mes cartes envoyées')}>
              Mes cartes envoyées
            </MenuItem>
            <MenuItem onSelect={() => handleMore('Aide')}>Aide</MenuItem>
            <MenuItem onSelect={() => handleMore("Politique d'utilisation des cookies")}>
              Politique d&apos;utilisation des cookies
            </MenuItem>
            <MenuItem onSelect={() => handleMore("Déclaration d'accessibilité")}>
              Déclaration d&apos;accessibilité
            </MenuItem>
          </DropdownPanel>
        </div>

        {/* Menu Langue. */}
        <div className="relative">
          <DropdownButton
            open={openMenu === 'language'}
            onToggle={() => toggleMenu('language')}
            ariaLabel="Choisir la langue"
          >
            <Globe className="size-4" aria-hidden />
            <span className="hidden sm:inline">Langue</span>
            <ChevronDown className="size-3 opacity-70" aria-hidden />
          </DropdownButton>
          <DropdownPanel open={openMenu === 'language'} labelledBy={`${uid}-language`}>
            <MenuItem onSelect={() => handleLanguage('nl')}>Nederlands</MenuItem>
            <MenuItem onSelect={() => handleLanguage('de')}>Deutsch</MenuItem>
            <MenuItem active onSelect={() => handleLanguage('fr')}>
              Français
            </MenuItem>
          </DropdownPanel>
        </div>

        {/* Menu Dossier personnel. */}
        <div className="relative">
          <DropdownButton
            open={openMenu === 'user'}
            onToggle={() => toggleMenu('user')}
            ariaLabel="Dossier personnel"
            className="max-w-[14rem]"
          >
            <UserCircle2 className="size-4" aria-hidden />
            <span className="hidden truncate sm:inline">
              {userName}
              <span className="mx-1.5 text-foreground/30">·</span>
              <span className="text-foreground/70">Dossier personnel</span>
            </span>
            <ChevronDown className="size-3 opacity-70" aria-hidden />
          </DropdownButton>
          <DropdownPanel open={openMenu === 'user'} labelledBy={`${uid}-user`}>
            <MenuItem
              icon={ShieldCheck}
              onSelect={() => handleUser(() => onRequestAccess?.())}
            >
              Demander un accès
            </MenuItem>
            <MenuItem
              icon={Settings2}
              onSelect={() => handleUser(() => onManageAccess?.())}
            >
              Gestion des accès
            </MenuItem>
            <div className="my-1 h-px bg-border/70" role="separator" />
            <MenuItem icon={LogOut} onSelect={() => handleUser(() => onLogout?.())}>
              Se déconnecter
            </MenuItem>
          </DropdownPanel>
        </div>
      </nav>
    </div>
  )
}
