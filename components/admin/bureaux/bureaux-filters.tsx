"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import type { BureauTypeCode } from "@/lib/bureaus/types";

// Labels dupliqués depuis bureaux-manager : on les garde locaux pour
// éviter un couplage circulaire avec le parent (le dialog en a aussi).
const TYPE_LABELS: Record<BureauTypeCode, string> = {
  CPAS: "CPAS",
  COMMUNE: "Commune",
  ONEM: "ONEM",
  SYNDICAT: "Syndicat",
  PERMANENCE: "Permanence",
  AUTRE: "Autre",
};

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filterType: BureauTypeCode | "all";
  onFilterTypeChange: (value: BureauTypeCode | "all") => void;
  filterRegion: string;
  onFilterRegionChange: (value: string) => void;
  filterActive: string;
  onFilterActiveChange: (value: string) => void;
  filterVerified: string;
  onFilterVerifiedChange: (value: string) => void;
};

export function BureauxFilters({
  search,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  filterRegion,
  onFilterRegionChange,
  filterActive,
  onFilterActiveChange,
  filterVerified,
  onFilterVerifiedChange,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5 mt-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Recherche : nom, ville, rue, CP..."
            className="pl-9"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Select
          value={filterType}
          onValueChange={(v) => onFilterTypeChange((v ?? "all") as BureauTypeCode | "all")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {(Object.keys(TYPE_LABELS) as BureauTypeCode[]).map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRegion} onValueChange={(v) => onFilterRegionChange(v ?? "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Région" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes régions</SelectItem>
            <SelectItem value="brussels">Bruxelles</SelectItem>
            <SelectItem value="wallonia">Wallonie</SelectItem>
            <SelectItem value="flanders">Flandre</SelectItem>
            <SelectItem value="germanophone">Communauté germanophone</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={(v) => onFilterActiveChange(v ?? "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="false">Désactivés</SelectItem>
            <SelectItem value="all">Tous</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-2">
        <Select value={filterVerified} onValueChange={(v) => onFilterVerifiedChange(v ?? "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Vérification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes vérifications</SelectItem>
            <SelectItem value="true">Vérifiés</SelectItem>
            <SelectItem value="false">Non vérifiés</SelectItem>
            <SelectItem value="stale">À revérifier (+6 mois ou jamais)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
