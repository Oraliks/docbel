"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Search, Save, Loader2, MapPin, Wand2 } from "lucide-react";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Onem = {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  color: string;
  communeIds: string[];
};

type Commune = {
  id: string;
  insCode: string;
  nameFr: string;
  nameNl: string | null;
  region: string;
  province: string | null;
  postalCodes: string[];
};

const PROVINCE_IDS = [
  "bruxelles",
  "antwerpen",
  "vlaams-brabant",
  "brabant-wallon",
  "hainaut",
  "liege",
  "limburg",
  "luxembourg",
  "namur",
  "oost-vlaanderen",
  "west-vlaanderen",
];

const REGION_IDS = ["brussels", "wallonia", "flanders", "germanophone"];

export function OnemAssignmentsManager() {
  const t = useTranslations("admin.bureaux");
  const provinceLabel = (id: string) =>
    t(`province_${id}` as Parameters<typeof t>[0]);
  const regionLabel = (id: string) =>
    t(`region_${id}` as Parameters<typeof t>[0]);
  const [bureaus, setBureaus] = useState<Onem[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBureauId, setSelectedBureauId] = useState<string>("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Initial load
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/bureaux/service-assignments?serviceType=chomage").then((r) => r.json()),
      fetch("/api/admin/communes?limit=600").then((r) => r.json()),
    ])
      .then(([oData, cData]) => {
        if (cancelled) return;
        const items = (oData?.items ?? []) as Onem[];
        const cs = (cData?.items ?? []) as Commune[];
        setBureaus(items);
        setCommunes(cs);
        if (items.length > 0 && !selectedBureauId) {
          setSelectedBureauId(items[0].id);
          setSelection(new Set(items[0].communeIds));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error(t("loadFailed"));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch selected bureau
  function selectBureau(id: string) {
    setSelectedBureauId(id);
    const b = bureaus.find((x) => x.id === id);
    setSelection(new Set(b?.communeIds ?? []));
  }

  const selectedBureau = bureaus.find((b) => b.id === selectedBureauId);

  // Pre-compute "owner" map : communeId → bureauId qui la dessert (pour conflits)
  const ownerByCommune = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of bureaus) {
      for (const c of b.communeIds) {
        if (!m.has(c)) m.set(c, b.id);
      }
    }
    return m;
  }, [bureaus]);

  const filteredCommunes = useMemo(() => {
    const s = search.trim().toLowerCase();
    return communes.filter((c) => {
      if (filterRegion !== "all" && c.region !== filterRegion) return false;
      if (filterStatus === "assigned" && !ownerByCommune.has(c.id)) return false;
      if (filterStatus === "unassigned" && ownerByCommune.has(c.id)) return false;
      if (filterStatus === "selected" && !selection.has(c.id)) return false;
      if (!s) return true;
      return (
        c.nameFr.toLowerCase().includes(s) ||
        (c.nameNl ?? "").toLowerCase().includes(s) ||
        c.insCode.includes(s) ||
        c.postalCodes.some((p) => p.startsWith(s))
      );
    });
  }, [communes, search, filterRegion, filterStatus, ownerByCommune, selection]);

  function toggleCommune(id: string) {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
  }

  function selectAllVisible() {
    const next = new Set(selection);
    for (const c of filteredCommunes) next.add(c.id);
    setSelection(next);
  }

  function deselectAllVisible() {
    const next = new Set(selection);
    for (const c of filteredCommunes) next.delete(c.id);
    setSelection(next);
  }

  async function autoAssign(scope: { province?: string; region?: string }, mode: "merge" | "replace") {
    if (!selectedBureauId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/bureaux/service-assignments/auto-by-territory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bureauId: selectedBureauId,
          serviceType: "chomage",
          scope,
          mode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? t("actionFailed"));
        return;
      }
      toast.success(t("communesAssigned", { count: data.applied }));
      // Reload data
      const [oData, cData] = await Promise.all([
        fetch("/api/admin/bureaux/service-assignments?serviceType=chomage").then((r) => r.json()),
        fetch("/api/admin/communes?limit=600").then((r) => r.json()),
      ]);
      const items = (oData?.items ?? []) as Onem[];
      setBureaus(items);
      setCommunes((cData?.items ?? []) as Commune[]);
      const updated = items.find((b) => b.id === selectedBureauId);
      if (updated) setSelection(new Set(updated.communeIds));
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!selectedBureauId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/bureaux/service-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bureauId: selectedBureauId,
          serviceType: "chomage",
          communeIds: [...selection],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? t("saveFailed"));
        return;
      }
      // Met à jour le state local
      setBureaus((prev) =>
        prev.map((b) => (b.id === selectedBureauId ? { ...b, communeIds: [...selection] } : b))
      );
      toast.success(t("communesAssigned", { count: selection.size }));
    } catch (err) {
      console.error(err);
      toast.error(t("networkError"));
    } finally {
      setSaving(false);
    }
  }

  // Stats globales
  const totalCommunes = communes.length;
  const assignedCount = ownerByCommune.size;
  const orphanCount = totalCommunes - assignedCount;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="flex items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("loading")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      {/* Liste des bureaux ONEM */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("onemBureausTitle", { count: bureaus.length })}</CardTitle>
          <div className="flex gap-2 text-xs text-muted-foreground mt-2">
            <Badge variant="outline" className="border-green-500 text-green-700">
              {t("assignedCount", { count: assignedCount })}
            </Badge>
            {orphanCount > 0 && (
              <Badge variant="outline" className="border-orange-500 text-orange-700">
                {t("orphanCount", { count: orphanCount })}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[60vh]">
            {bureaus.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => selectBureau(b.id)}
                className={`w-full text-left px-4 py-3 border-b transition-colors ${
                  selectedBureauId === b.id ? "bg-accent" : "hover:bg-muted"
                }`}
              >
                <div className="font-medium text-sm">{b.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <MapPin className="h-3 w-3" /> {b.postalCode} {b.city}
                </div>
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    style={{ borderColor: b.color, color: b.color }}
                  >
                    {t("communeCount", { count: b.communeIds.length })}
                  </Badge>
                </div>
              </button>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Sélection des communes */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">
                {selectedBureau ? selectedBureau.name : t("selectBureau")}
              </CardTitle>
              {selectedBureau && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("communesSelected", { count: selection.size })}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" disabled={!selectedBureauId || saving}>
                      <Wand2 className="mr-2 h-4 w-4" /> {t("autoAssign")}
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t("byProvinceAdd")}</DropdownMenuLabel>
                  {PROVINCE_IDS.map((id) => (
                    <DropdownMenuItem
                      key={id}
                      onClick={() => autoAssign({ province: id }, "merge")}
                    >
                      {provinceLabel(id)}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t("byRegionReplace")}</DropdownMenuLabel>
                  {REGION_IDS.map((id) => (
                    <DropdownMenuItem
                      key={id}
                      onClick={() => autoAssign({ region: id }, "replace")}
                    >
                      {regionLabel(id)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={selectAllVisible}>
                {t("checkAllVisible")}
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllVisible}>
                {t("uncheckAll")}
              </Button>
              <Button size="sm" onClick={save} disabled={!selectedBureauId || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> {t("save")}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("communeSearchShort")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterRegion} onValueChange={(v) => setFilterRegion(v ?? "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("regionAll")}</SelectItem>
                <SelectItem value="brussels">{t("regionBrussels")}</SelectItem>
                <SelectItem value="wallonia">{t("regionWallonia")}</SelectItem>
                <SelectItem value="flanders">{t("regionFlanders")}</SelectItem>
                <SelectItem value="germanophone">{t("regionGermanophone")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("statusFilterAll")}</SelectItem>
                <SelectItem value="selected">{t("statusFilterSelectedThis")}</SelectItem>
                <SelectItem value="assigned">{t("statusFilterAssignedOther")}</SelectItem>
                <SelectItem value="unassigned">{t("statusFilterUnassigned")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[55vh]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {filteredCommunes.map((c) => {
                const owned = ownerByCommune.get(c.id);
                const isSelected = selection.has(c.id);
                const ownedByOther = owned && owned !== selectedBureauId;
                return (
                  <Label
                    key={c.id}
                    className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted ${
                      isSelected ? "bg-accent/40" : ""
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleCommune(c.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1">
                        {c.nameFr}
                        {ownedByOther && (
                          <span
                            title={t("assignedToOtherOnem")}
                            className="text-xs text-orange-600"
                          >
                            ⚠
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.insCode}
                        {c.postalCodes.length > 0 && ` · ${c.postalCodes[0]}`}
                      </div>
                    </div>
                  </Label>
                );
              })}
            </div>
            {filteredCommunes.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t("noCommuneMatchFilters")}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
