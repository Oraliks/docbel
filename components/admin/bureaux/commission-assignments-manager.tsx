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
import { Search, Save, Loader2, MapPin } from "lucide-react";

type CandidateBureau = {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  organismeCode: string | null;
  organismeName: string | null;
  organismeColor: string;
  commissionIds: string[];
};

type Commission = {
  id: string;
  code: string;
  numero: string;
  numeroOfficiel: string;
  nom: string;
  label: string;
  type: string;
};

export function CommissionAssignmentsManager() {
  const [bureaus, setBureaus] = useState<CandidateBureau[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBureauId, setSelectedBureauId] = useState<string>("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [bureauSearch, setBureauSearch] = useState("");
  const [commissionSearch, setCommissionSearch] = useState("");

  // Load all bureaux candidats + commissions
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/bureaux/commission-assignments").then((r) => r.json()),
      fetch("/api/data/commissions").then((r) => r.json()).catch(() => ({ items: [] })),
    ])
      .then(([bData, cData]) => {
        if (cancelled) return;
        const items = (bData?.items ?? []) as CandidateBureau[];
        setBureaus(items);
        setCommissions((cData?.items ?? []) as Commission[]);
        if (items.length > 0) {
          setSelectedBureauId(items[0].id);
          setSelection(new Set(items[0].commissionIds));
        }
        setLoading(false);
      })
      .catch(() => {
        toast.error("Échec du chargement");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectBureau(id: string) {
    setSelectedBureauId(id);
    const b = bureaus.find((x) => x.id === id);
    setSelection(new Set(b?.commissionIds ?? []));
  }

  const selectedBureau = bureaus.find((b) => b.id === selectedBureauId);

  const filteredBureaus = useMemo(() => {
    const s = bureauSearch.trim().toLowerCase();
    if (!s) return bureaus;
    return bureaus.filter(
      (b) =>
        b.name.toLowerCase().includes(s) ||
        b.city.toLowerCase().includes(s) ||
        (b.organismeName ?? "").toLowerCase().includes(s)
    );
  }, [bureaus, bureauSearch]);

  const filteredCommissions = useMemo(() => {
    const s = commissionSearch.trim().toLowerCase();
    if (!s) return commissions.slice(0, 100);
    return commissions
      .filter(
        (c) =>
          c.numero.includes(s) ||
          c.numeroOfficiel.includes(s) ||
          c.nom.toLowerCase().includes(s) ||
          c.label.toLowerCase().includes(s) ||
          c.code.toLowerCase().includes(s)
      )
      .slice(0, 100);
  }, [commissions, commissionSearch]);

  function toggleCommission(id: string) {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
  }

  async function save() {
    if (!selectedBureauId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/bureaux/commission-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bureauId: selectedBureauId,
          commissionIds: [...selection],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Échec");
        return;
      }
      setBureaus((prev) =>
        prev.map((b) => (b.id === selectedBureauId ? { ...b, commissionIds: [...selection] } : b))
      );
      toast.success(`${selection.size} CP liée(s)`);
    } finally {
      setSaving(false);
    }
  }

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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{bureaus.length} bureau(x) candidats</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrer..."
              value={bureauSearch}
              onChange={(e) => setBureauSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[60vh]">
            {filteredBureaus.map((b) => (
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
                <div className="mt-1 flex gap-1.5">
                  {b.organismeName && (
                    <Badge
                      variant="outline"
                      style={{ borderColor: b.organismeColor, color: b.organismeColor }}
                    >
                      {b.organismeName}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10.5px]">
                    {b.commissionIds.length} CP
                  </Badge>
                </div>
              </button>
            ))}
            {filteredBureaus.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Aucun bureau correspond.
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">
                {selectedBureau ? selectedBureau.name : "Sélectionner un bureau"}
              </CardTitle>
              {selectedBureau && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selection.size} CP sélectionnée{selection.size > 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={!selectedBureauId || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> Enregistrer
              </Button>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Recherche CP : numéro, nom, secteur..."
              value={commissionSearch}
              onChange={(e) => setCommissionSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {commissions.length} CP en base ({filteredCommissions.length} affichées)
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[60vh]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {filteredCommissions.map((c) => {
                const isSelected = selection.has(c.id);
                return (
                  <Label
                    key={c.id}
                    className={`flex items-start gap-2 px-2 py-2 rounded cursor-pointer hover:bg-muted ${
                      isSelected ? "bg-accent/40" : ""
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleCommission(c.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        CP {c.numeroOfficiel}
                        <span className="ml-1 text-xs text-muted-foreground font-normal">
                          ({c.type})
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {c.nom}
                      </div>
                    </div>
                  </Label>
                );
              })}
            </div>
            {filteredCommissions.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aucune CP correspond.
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
