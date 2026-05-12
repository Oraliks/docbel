"use client";

import { useEffect, useMemo, useState } from "react";
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

export function OnemAssignmentsManager() {
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
      fetch("/api/admin/bureaux/onem-assignments").then((r) => r.json()),
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
        toast.error("Échec du chargement");
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
      const res = await fetch("/api/admin/bureaux/onem-assignments/auto-by-province", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bureauId: selectedBureauId, scope, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Échec");
        return;
      }
      toast.success(`${data.applied} commune(s) assignée(s)`);
      // Reload data
      const [oData, cData] = await Promise.all([
        fetch("/api/admin/bureaux/onem-assignments").then((r) => r.json()),
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
      const res = await fetch("/api/admin/bureaux/onem-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bureauId: selectedBureauId, communeIds: [...selection] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Échec de la sauvegarde");
        return;
      }
      // Met à jour le state local
      setBureaus((prev) =>
        prev.map((b) => (b.id === selectedBureauId ? { ...b, communeIds: [...selection] } : b))
      );
      toast.success(`${selection.size} commune(s) assignée(s)`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
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
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement...
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
          <CardTitle className="text-base">Bureaux ONEM ({bureaus.length})</CardTitle>
          <div className="flex gap-2 text-xs text-muted-foreground mt-2">
            <Badge variant="outline" className="border-green-500 text-green-700">
              {assignedCount} assignées
            </Badge>
            {orphanCount > 0 && (
              <Badge variant="outline" className="border-orange-500 text-orange-700">
                {orphanCount} orphelines
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
                    {b.communeIds.length} commune{b.communeIds.length > 1 ? "s" : ""}
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
                {selectedBureau ? selectedBureau.name : "Sélectionner un bureau"}
              </CardTitle>
              {selectedBureau && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selection.size} commune{selection.size > 1 ? "s" : ""} sélectionnée
                  {selection.size > 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" disabled={!selectedBureauId || saving}>
                      <Wand2 className="mr-2 h-4 w-4" /> Auto-assigner
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Par province (ajout)</DropdownMenuLabel>
                  {[
                    { id: "bruxelles", label: "Bruxelles-Capitale" },
                    { id: "antwerpen", label: "Anvers" },
                    { id: "vlaams-brabant", label: "Brabant flamand" },
                    { id: "brabant-wallon", label: "Brabant wallon" },
                    { id: "hainaut", label: "Hainaut" },
                    { id: "liege", label: "Liège" },
                    { id: "limburg", label: "Limbourg" },
                    { id: "luxembourg", label: "Luxembourg" },
                    { id: "namur", label: "Namur" },
                    { id: "oost-vlaanderen", label: "Flandre orientale" },
                    { id: "west-vlaanderen", label: "Flandre occidentale" },
                  ].map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => autoAssign({ province: p.id }, "merge")}
                    >
                      {p.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Par région (remplace)</DropdownMenuLabel>
                  {[
                    { id: "brussels", label: "Bruxelles" },
                    { id: "wallonia", label: "Wallonie" },
                    { id: "flanders", label: "Flandre" },
                    { id: "germanophone", label: "Communauté germanophone" },
                  ].map((r) => (
                    <DropdownMenuItem
                      key={r.id}
                      onClick={() => autoAssign({ region: r.id }, "replace")}
                    >
                      {r.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={selectAllVisible}>
                Tout cocher (visible)
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllVisible}>
                Tout décocher
              </Button>
              <Button size="sm" onClick={save} disabled={!selectedBureauId || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> Enregistrer
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Recherche : nom, INS, CP"
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
                <SelectItem value="all">Toutes régions</SelectItem>
                <SelectItem value="brussels">Bruxelles</SelectItem>
                <SelectItem value="wallonia">Wallonie</SelectItem>
                <SelectItem value="flanders">Flandre</SelectItem>
                <SelectItem value="germanophone">Communauté germanophone</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="selected">Sélectionnées (ce bureau)</SelectItem>
                <SelectItem value="assigned">Déjà assignées (autre bureau)</SelectItem>
                <SelectItem value="unassigned">Non assignées</SelectItem>
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
                            title="Déjà assignée à un autre bureau ONEM"
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
                Aucune commune correspond aux filtres.
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
