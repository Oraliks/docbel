'use client'

import React from 'react'
import {
  // common icons curated for marketing blocks
  Zap,
  Lock,
  Shield,
  Smartphone,
  Globe,
  Star,
  Heart,
  Bookmark,
  Bell,
  Mail,
  MessageCircle,
  Phone,
  Calendar,
  Clock,
  MapPin,
  Home,
  User,
  Users,
  Settings,
  Search,
  Check,
  Award,
  Trophy,
  Target,
  TrendingUp,
  TrendingDown,
  BarChart,
  PieChart,
  DollarSign,
  CreditCard,
  ShoppingBag,
  ShoppingCart,
  Package,
  Truck,
  Gift,
  Tag,
  FileText,
  File,
  Folder,
  Database,
  Cloud,
  Server,
  Wifi,
  Cpu,
  Code,
  Terminal,
  Rocket,
  Sparkles,
  Sun,
  Moon,
  Coffee,
  Camera,
  Image,
  Video,
  Music,
  Play,
  Pause,
  Mic,
  Headphones,
  Book,
  GraduationCap,
  Briefcase,
  Building,
  Building2,
  Factory,
  Wrench,
  Hammer,
  Bug,
  Layers,
  LayoutGrid,
  Grid3x3,
  Palette,
  Brush,
  Pencil,
  Eye,
  EyeOff,
  Lightbulb,
  Compass,
  Map,
  Navigation,
  Plane,
  Car,
  Bus,
  Bike,
  Anchor,
  Flag,
  Flame,
  Snowflake,
  Leaf,
  TreePine,
  Sprout,
  ChevronRight,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Minus,
  X as XIcon,
  type LucideIcon,
} from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export const ICONS: Record<string, LucideIcon> = {
  zap: Zap, lock: Lock, shield: Shield, smartphone: Smartphone, globe: Globe,
  star: Star, heart: Heart, bookmark: Bookmark, bell: Bell,
  mail: Mail, 'message-circle': MessageCircle, phone: Phone,
  calendar: Calendar, clock: Clock, 'map-pin': MapPin, home: Home,
  user: User, users: Users, settings: Settings, search: Search, check: Check,
  award: Award, trophy: Trophy, target: Target,
  'trending-up': TrendingUp, 'trending-down': TrendingDown,
  'bar-chart': BarChart, 'pie-chart': PieChart,
  'dollar-sign': DollarSign, 'credit-card': CreditCard,
  'shopping-bag': ShoppingBag, 'shopping-cart': ShoppingCart,
  package: Package, truck: Truck, gift: Gift, tag: Tag,
  'file-text': FileText, file: File, folder: Folder,
  database: Database, cloud: Cloud, server: Server, wifi: Wifi,
  cpu: Cpu, code: Code, terminal: Terminal, rocket: Rocket,
  sparkles: Sparkles, sun: Sun, moon: Moon, coffee: Coffee,
  camera: Camera, image: Image, video: Video, music: Music,
  play: Play, pause: Pause, mic: Mic, headphones: Headphones,
  book: Book, 'graduation-cap': GraduationCap, briefcase: Briefcase,
  building: Building, building2: Building2, factory: Factory,
  wrench: Wrench, hammer: Hammer, bug: Bug,
  layers: Layers, 'layout-grid': LayoutGrid, 'grid-3x3': Grid3x3,
  palette: Palette, brush: Brush, pencil: Pencil,
  eye: Eye, 'eye-off': EyeOff, lightbulb: Lightbulb,
  compass: Compass, map: Map, navigation: Navigation,
  plane: Plane, car: Car, bus: Bus, bike: Bike,
  anchor: Anchor, flag: Flag, flame: Flame, snowflake: Snowflake,
  leaf: Leaf, 'tree-pine': TreePine, sprout: Sprout,
  'chevron-right': ChevronRight, 'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight, plus: Plus, minus: Minus,
}

const ICON_NAMES = Object.keys(ICONS)

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [query, setQuery] = React.useState('')
  const [open, setOpen] = React.useState(false)

  const filtered = React.useMemo(() => {
    if (!query.trim()) return ICON_NAMES
    const q = query.toLowerCase().trim()
    return ICON_NAMES.filter((n) => n.includes(q))
  }, [query])

  // Detect if value is a single emoji vs an icon key
  const isIconKey = !!ICONS[value]
  const Icon = isIconKey ? ICONS[value] : null

  return (
    <div className="flex items-stretch gap-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Emoji ou icône (ex: zap)"
        className="h-8 text-xs flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="icon-sm" variant="outline" className="h-8 w-8 shrink-0" title="Choisir une icône">
            {Icon ? <Icon className="size-4" /> : <span className="text-base leading-none">{value || '✨'}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="h-7 pl-7 text-xs"
              />
              {value && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5"
                  onClick={() => {
                    onChange('')
                    setOpen(false)
                  }}
                  title="Effacer"
                >
                  <XIcon className="size-3" />
                </Button>
              )}
            </div>
            <ScrollArea className="h-56">
              <div className="grid grid-cols-7 gap-1 pr-2">
                {filtered.map((name) => {
                  const Ico = ICONS[name]
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onChange(name)
                        setOpen(false)
                      }}
                      title={name}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-md text-foreground/70 hover:bg-muted transition',
                        value === name && 'bg-primary text-primary-foreground'
                      )}
                    >
                      <Ico className="size-4" />
                    </button>
                  )
                })}
                {filtered.length === 0 && (
                  <div className="col-span-7 py-6 text-center text-xs text-muted-foreground">
                    Aucune icône
                  </div>
                )}
              </div>
            </ScrollArea>
            <p className="text-[10px] text-muted-foreground">
              Astuce : tu peux aussi taper un emoji direct dans le champ.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** Helper: render an icon string as React node — emoji or Lucide. */
export function renderIcon(value: string | undefined, className = 'size-5'): React.ReactNode {
  if (!value) return null
  const Ico = ICONS[value]
  if (Ico) return <Ico className={className} />
  return <span className="text-2xl leading-none">{value}</span>
}
