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

type ServiceBureau = {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  color: string;
  organismeCode: string | null;
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

const SERVICE_VALUES = [
  "chomage",
  "paiement_capac",
  "paiement_fgtb",
  "paiement_csc",
  "paiement_synova",
  "mutuelle_solidaris",
  "mutuelle_mc",
  "mutuelle_mloz",
  "emploi_regional",
  "pension",
];

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

export function ServiceAssignmentsManager() {
  const t = useTranslations("admin.bureaux");
  const provinceLabel = (id: string) =>
    t(`province_${id}` as Parameters<typeof t>[0]);
  const regionLabel = (id: string) =>
    t(`region_${id}` as Parameters<typeof t>[0]);
  const serviceLabel = (v: string) =>
    t(`svcType_${v}` as Parameters<typeof t>[0]);
  const serviceHelper = (v: string) =>
    t(`svcTypeHelper_${v}` as Parameters<typeof t>[0]);
  const [serviceType, setServiceType] = useState("chomage");
  const [bureaus, setBureaus] = useState<ServiceBureau[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBureauId, setSelectedBureauId] = useState<string>("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Load bureaus for current service
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/bureaux/service-assignments?serviceType=${serviceType}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const items = (data?.items ?? []) as ServiceBureau[];
        setBureaus(items);
        if (items.length > 0) {
          setSelectedBureauId(items[0].id);
          setSelection(new Set(items[0].communeIds));
        } else {
          setSelectedBureauId("");
          setSelection(new Set());
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error(t("loadFailed"));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load communes once
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/communes?limit=600")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setCommunes((data?.items ?? []) as Commune[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function selectBureau(id: string) {
    setSelectedBureauId(id);
    const b = bureaus.find((x) => x.id === id);
    setSelection(new Set(b?.communeIds ?? []));
  }

  const selectedBureau = bureaus.find((b) => b.id === selectedBureauId);

  // owner map pour conflits
  const ownerByCommune = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of bureaus) for (const c of b.communeIds) if (!m.has(c)) m.set(c, b.id);
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
    // Réutilise l'endpoint auto-by-province existant pour ONEM, sinon manuel pour les autres
    if (serviceType === "chomage") {
      setSaving(true);
      try {
        const res = await fetch("/api/admin/bureaux/onem-assignments/auto-by-province", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bureauId: selectedBureauId, scope, mode }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error ?? t("actionFailed"));
          return;
        }
        toast.success(t("communesAssigned", { count: data.applied }));
        // Reload
        const r = await fetch(`/api/admin/bureaux/service-assignments?serviceType=${serviceType}`);
        const j = await r.json();
        setBureaus(j?.items ?? []);
        const updated = (j?.items as ServiceBureau[]).find((b) => b.id === selectedBureauId);
        if (updated) setSelection(new Set(updated.communeIds));
      } finally {
        setSaving(false);
      }
    } else {
      // Pour les autres serviceTypes, on construit la liste localement
      const targetCommunes = communes
        .filter((c) => (scope.province ? c.province === scope.province : true))
        .filter((c) => (scope.region ? c.region === scope.region : true));
      const newSel = mode === "replace" ? new Set<string>() : new Set(selection);
      for (const c of targetCommunes) newSel.add(c.id);
      setSelection(newSel);
      toast.success(t("communesAddedToCart", { count: targetCommunes.length }));
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
          communeIds: [...selection],
          serviceType,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? t("actionFailed"));
        return;
      }
      setBureaus((prev) =>
        prev.map((b) => (b.id === selectedBureauId ? { ...b, communeIds: [...selection] } : b))
      );
      toast.success(t("communesAssigned", { count: selection.size }));
    } finally {
      setSaving(false);
    }
  }

  const totalCommunes = communes.length;
  const assignedCount = ownerByCommune.size;
  const orphanCount = totalCommunes - assignedCount;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <Label className="text-xs">{t("serviceToConfigure")}</Label>
          <Select value={serviceType} onValueChange={(v) => setServiceType(v ?? "chomage")}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_VALUES.map((v) => (
                <SelectItem key={v} value={v}>
                  {serviceLabel(v)}
                  <span className="text-muted-foreground ml-2 text-xs">— {serviceHelper(v)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("loading")}
            </div>
          </CardContent>
        </Card>
      ) : bureaus.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            {t.rich("noActiveBureauForService", {
              link: (chunks) => (
                <a href="/admin/bureaux" className="underline">
                  {chunks}
                </a>
              ),
            })}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("bureauxCount", { count: bureaus.length })}</CardTitle>
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
                      <Badge variant="outline" style={{ borderColor: b.color, color: b.color }}>
                        {t("communeCount", { count: b.communeIds.length })}
                      </Badge>
                    </div>
                  </button>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>

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
                    <SelectItem value="selected">{t("statusFilterSelected")}</SelectItem>
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
                                title={t("assignedToOther")}
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
      )}
    </div>
  );
}
