"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { Section, SortKey, StatusFilter } from "./types";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  status: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  sort: SortKey;
  onSortChange: (v: SortKey) => void;
  sections: Section[];
}

const SORT_LABEL: Record<SortKey, string> = {
  category: "Catégorie",
  name: "Nom A→Z",
  recent: "Plus récent",
};

/**
 * Barre de filtres + tri + bouton d'ajout. Disposition responsive :
 * - mobile : empilée
 * - desktop : recherche flex-1, selects à droite, actions à l'extrémité
 */
export function FiltersBar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  sections,
}: Props) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      {/* Recherche */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un outil (nom, slug, description)…"
          className="pl-9"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Filtre catégorie */}
      <Select
        value={category}
        onValueChange={(v) => onCategoryChange(v ?? "all")}
      >
        <SelectTrigger className="min-w-[180px]">
          <SelectValue placeholder="Catégorie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes catégories</SelectItem>
          {sections.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filtre statut */}
      <Select
        value={status}
        onValueChange={(v) => onStatusChange((v ?? "all") as StatusFilter)}
      >
        <SelectTrigger className="min-w-[160px]">
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous</SelectItem>
          <SelectItem value="active">Actifs uniquement</SelectItem>
          <SelectItem value="inactive">Inactifs uniquement</SelectItem>
        </SelectContent>
      </Select>

      {/* Tri */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Trier&nbsp;:</span>{" "}
              {SORT_LABEL[sort]}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-[180px]">
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <DropdownMenuItem
              key={k}
              onClick={() => onSortChange(k)}
              className={sort === k ? "bg-accent/60 font-semibold" : ""}
            >
              {SORT_LABEL[k]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Ajouter — placeholder MVP (création via seed/DB pour l'instant) */}
      <Button
        size="sm"
        className="h-9 gap-1.5"
        onClick={() =>
          toast.info(
            "Bientôt — créer un outil via le seed ou directement en DB.",
          )
        }
      >
        <Plus className="h-3.5 w-3.5" />
        Ajouter
      </Button>
    </div>
  );
}
