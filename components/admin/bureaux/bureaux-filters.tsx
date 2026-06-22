"use client";

import { useTranslations } from "next-intl";
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

// Ordre des types pour le filtre ; libellés via i18n (typeShort*).
const TYPE_CODES: BureauTypeCode[] = [
  "CPAS",
  "COMMUNE",
  "ONEM",
  "SYNDICAT",
  "PERMANENCE",
  "AUTRE",
];

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
  const t = useTranslations("admin.bureaux");
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5 mt-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("filterSearchPlaceholder")}
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
            <SelectValue placeholder={t("filterTypePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterTypeAll")}</SelectItem>
            {TYPE_CODES.map((code) => (
              <SelectItem key={code} value={code}>
                {t(`typeShort${code}` as Parameters<typeof t>[0])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRegion} onValueChange={(v) => onFilterRegionChange(v ?? "all")}>
          <SelectTrigger>
            <SelectValue placeholder={t("filterRegionPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("regionAll")}</SelectItem>
            <SelectItem value="brussels">{t("regionBrussels")}</SelectItem>
            <SelectItem value="wallonia">{t("regionWallonia")}</SelectItem>
            <SelectItem value="flanders">{t("regionFlanders")}</SelectItem>
            <SelectItem value="germanophone">{t("regionGermanophone")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={(v) => onFilterActiveChange(v ?? "all")}>
          <SelectTrigger>
            <SelectValue placeholder={t("filterStatusPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t("filterStatusActive")}</SelectItem>
            <SelectItem value="false">{t("filterStatusInactive")}</SelectItem>
            <SelectItem value="all">{t("filterStatusAll")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-2">
        <Select value={filterVerified} onValueChange={(v) => onFilterVerifiedChange(v ?? "all")}>
          <SelectTrigger>
            <SelectValue placeholder={t("filterVerifPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterVerifAll")}</SelectItem>
            <SelectItem value="true">{t("filterVerifVerified")}</SelectItem>
            <SelectItem value="false">{t("filterVerifNotVerified")}</SelectItem>
            <SelectItem value="stale">{t("filterVerifStale")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
