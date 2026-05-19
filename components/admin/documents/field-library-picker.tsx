"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Star,
  Type as TypeIcon,
  AlignLeft,
  Hash,
  Calendar,
  CheckSquare,
  ChevronDown,
  IdCard,
  CreditCard,
  MapPin,
  Building2,
  Phone,
  PenTool,
  HelpCircle,
  Library,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/// Forme minimale d'un preset (canonical field) telle qu'utilisée par le picker.
/// Acceptée par les composants parents qui passent leurs PresetOption[].
export interface CanonicalFieldPreset {
  id: string;
  name: string;
  description: string | null;
  category: string;
  fieldType: string;
  defaultLabel: string | null;
  defaultWidth: number | null;
  defaultHeight: number | null;
  defaultValue: string | null;
  defaultOptions: unknown;
  helpText: string | null;
  placeholder: string | null;
  popular: boolean;
  icon: string | null;
}

interface Props {
  presets: CanonicalFieldPreset[];
  /// Callback quand un preset est sélectionné : le parent crée une nouvelle
  /// zone avec les méta-données du preset.
  onPick: (preset: CanonicalFieldPreset) => void;
  /// Désactive le picker (ex. avant chargement PDF).
  disabled?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  identity: "Identité",
  contact: "Contact",
  address: "Adresse",
  bank: "Bancaire",
  employer: "Employeur",
  social: "Social",
  document: "Document",
  other: "Autre",
  custom: "Personnalisé",
  belgian: "Belge",
  financial: "Financier",
  date: "Date",
};

const FALLBACK_TYPE_ICONS: Record<string, LucideIcon> = {
  text: TypeIcon,
  textarea: AlignLeft,
  number: Hash,
  date: Calendar,
  checkbox: CheckSquare,
  select: ChevronDown,
  niss: IdCard,
  iban: CreditCard,
  postal_be: MapPin,
  tva_be: Building2,
  bce: Building2,
  phone_be: Phone,
  signature: PenTool,
};

const NAMED_ICONS: Record<string, LucideIcon> = {
  Type: TypeIcon,
  AlignLeft,
  Hash,
  Calendar,
  CheckSquare,
  ChevronDown,
  IdCard,
  CreditCard,
  MapPin,
  Building2,
  Phone,
  PenTool,
};

function getIconFor(preset: CanonicalFieldPreset): LucideIcon {
  if (preset.icon && NAMED_ICONS[preset.icon]) return NAMED_ICONS[preset.icon];
  return FALLBACK_TYPE_ICONS[preset.fieldType] ?? HelpCircle;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function FieldLibraryPicker({ presets, onPick, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("popular");

  // Récupère uniquement les presets qui ont les données canoniques
  // (defaultLabel/Width/Height), pour ne pas polluer avec des presets legacy.
  const canonicalPresets = useMemo(
    () =>
      presets.filter(
        (p) => p.defaultLabel && p.defaultWidth && p.defaultHeight
      ),
    [presets]
  );

  const popularPresets = useMemo(
    () => canonicalPresets.filter((p) => p.popular),
    [canonicalPresets]
  );

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of canonicalPresets) cats.add(p.category);
    return ["popular", ...Array.from(cats).sort()];
  }, [canonicalPresets]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    let list =
      activeCategory === "popular"
        ? popularPresets
        : canonicalPresets.filter((p) => p.category === activeCategory);
    if (q) {
      list = list.filter((p) => {
        const hay = normalize(
          `${p.name} ${p.defaultLabel ?? ""} ${p.description ?? ""} ${p.fieldType}`
        );
        return hay.includes(q);
      });
    }
    return list;
  }, [search, activeCategory, popularPresets, canonicalPresets]);

  function handlePick(preset: CanonicalFieldPreset) {
    onPick(preset);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="default"
          disabled={disabled}
          title="Ajouter un champ depuis la bibliothèque canonique"
        >
          <Library className="w-4 h-4 mr-1" />
          Bibliothèque
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-0" align="end">
        <div className="flex flex-col max-h-[60vh]">
          {/* Search bar */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (NISS, email, signature…)"
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1 p-2 border-b">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              const label =
                cat === "popular" ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3" />
                    Populaires
                  </span>
                ) : (
                  CATEGORY_LABELS[cat] ?? cat
                );
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Field list */}
          <div className="flex-1 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Aucun champ ne correspond.
              </div>
            ) : (
              <ul className="space-y-1">
                {filtered.map((p) => {
                  const Icon = getIconFor(p);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => handlePick(p)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-muted transition-colors flex items-start gap-2 group"
                      >
                        <span className="inline-flex items-center justify-center size-7 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 flex-shrink-0 group-hover:bg-blue-200">
                          <Icon className="size-3.5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            <span className="truncate">{p.defaultLabel}</span>
                            {p.popular && (
                              <Star className="size-3 text-amber-500 flex-shrink-0" />
                            )}
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 px-1 flex-shrink-0"
                            >
                              {p.fieldType}
                            </Badge>
                          </div>
                          {p.description && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {p.description}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer count */}
          <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
            {filtered.length} / {canonicalPresets.length} champ{canonicalPresets.length > 1 ? "s" : ""}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
