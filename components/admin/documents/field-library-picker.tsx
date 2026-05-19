"use client";

import { createElement, useMemo, useState } from "react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
    // Recherche : si on tape, on ignore la catégorie et on cherche dans tout
    if (q) {
      list = canonicalPresets.filter((p) => {
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
    setActiveCategory("popular");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            size="sm"
            variant="default"
            disabled={disabled}
            title="Ajouter un champ depuis la bibliothèque canonique"
          >
            <Library className="w-4 h-4 mr-1" />
            Bibliothèque
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Library className="size-4" />
            Bibliothèque de champs
          </SheetTitle>
          <SheetDescription>
            {canonicalPresets.length} presets canoniques. Cliquez pour ajouter au
            centre de la page courante.
          </SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="px-4 py-2 border-b">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (NISS, email, signature…)"
              className="pl-9 h-9"
              autoFocus
            />
          </div>
        </div>

        {/* Category tabs */}
        {!search && (
          <div className="flex flex-wrap gap-1 px-3 py-2 border-b">
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
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/70 text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Field grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Aucun champ ne correspond à « {search} ».
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5">
              {filtered.map((p) => (
                <FieldCard key={p.id} preset={p} onPick={handlePick} />
              ))}
            </div>
          )}
        </div>

        {/* Footer count */}
        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground bg-muted/20">
          {filtered.length} / {canonicalPresets.length} champ
          {canonicalPresets.length > 1 ? "s" : ""}
          {search && (
            <span className="ml-2">— recherche « {search} »</span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface FieldCardProps {
  preset: CanonicalFieldPreset;
  onPick: (preset: CanonicalFieldPreset) => void;
}

/// Carte d'un preset dans la grille. Sortie comme composant pour éviter le
/// pattern lint react-hooks/static-components (composant Icon en variable).
function FieldCard({ preset, onPick }: FieldCardProps) {
  const iconNode = createElement(getIconFor(preset), {
    className: "size-4",
  });
  return (
    <button
      type="button"
      onClick={() => onPick(preset)}
      className="w-full text-left p-2.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-colors flex items-start gap-2.5 group"
    >
      <span className="inline-flex items-center justify-center size-8 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex-shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-900">
        {iconNode}
      </span>
      <div className="flex-1 min-w-0 py-0.5">
        <div className="text-sm font-medium flex items-center gap-1.5">
          <span className="truncate">{preset.defaultLabel ?? preset.name}</span>
          {preset.popular && (
            <Star className="size-3 text-amber-500 flex-shrink-0" />
          )}
        </div>
        {preset.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
            {preset.description}
          </p>
        )}
        <div className="flex items-center gap-1 mt-1">
          <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4">
            {preset.fieldType}
          </Badge>
          <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4">
            {CATEGORY_LABELS[preset.category] ?? preset.category}
          </Badge>
        </div>
      </div>
    </button>
  );
}
