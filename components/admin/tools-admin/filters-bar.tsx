"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEGMENT_LABEL } from "./shared";
import type { Section, StatusFilter } from "./types";

interface FiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  type: string;
  onTypeChange: (v: string) => void;
  audience: string;
  onAudienceChange: (v: string) => void;
  status: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  sections: Section[];
  /** Libellés de type distincts présents dans le catalogue (ex: "Calculateur"). */
  typeOptions: string[];
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Statut : Tous" },
  { value: "active", label: "Actifs" },
  { value: "inactive", label: "Inactifs" },
  { value: "popular", label: "Populaires" },
];

/**
 * Barre de filtres pour /admin/chomage/outils (refonte mockup 2026-06).
 * Tout en selects alignés à droite d'une recherche : Catégorie (section),
 * Type, Audience (segment d'accès) et Statut. Aucune logique métier ici —
 * `workspace.tsx` orchestre le filtrage.
 */
export function FiltersBar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  type,
  onTypeChange,
  audience,
  onAudienceChange,
  status,
  onStatusChange,
  sections,
  typeOptions,
}: FiltersBarProps) {
  return (
    <div
      role="group"
      aria-label="Filtres outils"
      className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center"
    >
      {/* Recherche */}
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Rechercher un outil"
          placeholder="Rechercher un outil..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-9"
        />
      </div>

      {/* Catégorie (section) */}
      <Select value={category} onValueChange={(v) => onCategoryChange(v ?? "all")}>
        <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filtrer par catégorie">
          <SelectValue placeholder="Toutes catégories" />
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

      {/* Type */}
      <Select value={type} onValueChange={(v) => onTypeChange(v ?? "all")}>
        <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Filtrer par type">
          <SelectValue placeholder="Tous types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous types</SelectItem>
          {typeOptions.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Audience (segment d'accès) */}
      <Select value={audience} onValueChange={(v) => onAudienceChange(v ?? "all")}>
        <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filtrer par audience">
          <SelectValue placeholder="Toutes audiences" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes audiences</SelectItem>
          <SelectItem value="citoyen">{SEGMENT_LABEL.citoyen}</SelectItem>
          <SelectItem value="employeur">{SEGMENT_LABEL.employeur}</SelectItem>
          <SelectItem value="partenaire">{SEGMENT_LABEL.partenaire}</SelectItem>
        </SelectContent>
      </Select>

      {/* Statut */}
      <Select
        value={status}
        onValueChange={(v) => onStatusChange((v as StatusFilter) ?? "all")}
      >
        <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Filtrer par statut">
          <SelectValue placeholder="Statut : Tous" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
