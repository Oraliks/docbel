"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";

type Strategy = "translate" | "translate_gloss" | "keep";

type Term = {
  id: string;
  term: string;
  strategy: string;
  glossFr: string;
  note: string | null;
  category: string;
  order: number;
};

const STRATEGY_OPTIONS: { value: Strategy; label: string }[] = [
  { value: "translate", label: "🟢 Traduire" },
  { value: "translate_gloss", label: "🟡 Traduire + glose" },
  { value: "keep", label: "🔴 Garder + glose" },
];
const stratLabel = (s: string) =>
  STRATEGY_OPTIONS.find((o) => o.value === s)?.label ?? s;

type Draft = { term: string; strategy: string; glossFr: string; note: string; category: string };
const emptyDraft: Draft = { term: "", strategy: "translate_gloss", glossFr: "", note: "", category: "" };

export function GlossaryManager() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newTerm, setNewTerm] = useState<Draft>(emptyDraft);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/glossary");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { terms: Term[] };
      setTerms(data.terms);
      const d: Record<string, Draft> = {};
      for (const t of data.terms)
        d[t.id] = {
          term: t.term,
          strategy: t.strategy,
          glossFr: t.glossFr,
          note: t.note ?? "",
          category: t.category,
        };
      setDrafts(d);
    } catch {
      toast.error("Erreur lors du chargement du glossaire");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = (t: Term) => {
    const d = drafts[t.id];
    return (
      !!d &&
      (d.term !== t.term ||
        d.strategy !== t.strategy ||
        d.glossFr !== t.glossFr ||
        d.note !== (t.note ?? "") ||
        d.category !== t.category)
    );
  };

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  const save = async (t: Term) => {
    const d = drafts[t.id];
    if (!d) return;
    if (!d.term.trim() || !d.glossFr.trim()) {
      toast.error("Le terme et la glose sont requis.");
      return;
    }
    setSavingId(t.id);
    try {
      const res = await fetch(`/api/admin/glossary/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || "Échec");
      setTerms((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
      toast.success("Terme enregistré");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setSavingId(null);
    }
  };

  const del = async (t: Term) => {
    if (!confirm(`Supprimer « ${t.term} » du glossaire ?`)) return;
    setDeletingId(t.id);
    try {
      const res = await fetch(`/api/admin/glossary/${t.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Échec");
      setTerms((prev) => prev.filter((x) => x.id !== t.id));
      toast.success("Terme supprimé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  };

  const add = async () => {
    if (!newTerm.term.trim() || !newTerm.glossFr.trim()) {
      toast.error("Le terme et la glose sont requis.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTerm),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "Échec");
      setTerms((prev) => [...prev, created]);
      setDrafts((p) => ({
        ...p,
        [created.id]: {
          term: created.term,
          strategy: created.strategy,
          glossFr: created.glossFr,
          note: created.note ?? "",
          category: created.category,
        },
      }));
      setNewTerm(emptyDraft);
      setShowAdd(false);
      toast.success("Terme ajouté");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'ajout");
    } finally {
      setAdding(false);
    }
  };

  // Filtrage + regroupement par catégorie.
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? terms.filter((t) =>
          [t.term, t.glossFr, t.note ?? "", t.category]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : terms;
    const map = new Map<string, Term[]>();
    for (const t of filtered) {
      const c = t.category || "Divers";
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(t);
    }
    return Array.from(map.entries());
  }, [terms, search]);

  const categories = useMemo(
    () => Array.from(new Set(terms.map((t) => t.category).filter(Boolean))).sort(),
    [terms]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Barre : recherche + ajouter */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un terme, une glose…"
            className="pl-8"
          />
        </div>
        <div className="text-sm text-muted-foreground">{terms.length} termes</div>
        <Button onClick={() => setShowAdd((v) => !v)} className="gap-1.5">
          {showAdd ? <X className="size-4" /> : <Plus className="size-4" />}
          {showAdd ? "Annuler" : "Ajouter un terme"}
        </Button>
      </div>

      {/* Formulaire d'ajout */}
      {showAdd && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Terme / sigle</Label>
              <Input
                value={newTerm.term}
                onChange={(e) => setNewTerm((p) => ({ ...p, term: e.target.value }))}
                placeholder="ex. ONEM"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Stratégie</Label>
              <Select
                value={newTerm.strategy}
                onValueChange={(v) => setNewTerm((p) => ({ ...p, strategy: v ?? p.strategy }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Glose figée (FR)</Label>
              <Textarea
                value={newTerm.glossFr}
                onChange={(e) => setNewTerm((p) => ({ ...p, glossFr: e.target.value }))}
                placeholder="explication courte, reprise dans chaque langue"
                className="min-h-16"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Équivalents / note</Label>
              <Input
                value={newTerm.note}
                onChange={(e) => setNewTerm((p) => ({ ...p, note: e.target.value }))}
                placeholder="ex. NL: RVA · DE: LfA"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Catégorie</Label>
              <Input
                value={newTerm.category}
                onChange={(e) => setNewTerm((p) => ({ ...p, category: e.target.value }))}
                placeholder="ex. Institutions & organismes"
                list="glossary-categories"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={add} disabled={adding} className="gap-1.5">
              {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Ajouter
            </Button>
          </div>
        </div>
      )}

      <datalist id="glossary-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Chargement…
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          Aucun terme.
        </div>
      ) : (
        grouped.map(([cat, list]) => (
          <div key={cat} className="flex flex-col gap-2">
            <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {cat} <span className="text-muted-foreground/50">({list.length})</span>
            </h2>
            {list.map((t) => {
              const d = drafts[t.id] ?? emptyDraft;
              const dirty = isDirty(t);
              return (
                <div
                  key={t.id}
                  className={`rounded-xl border bg-card p-3 transition-shadow ${dirty ? "border-primary/40 shadow-sm shadow-primary/10" : ""}`}
                >
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                    <div className="grid gap-3 sm:grid-cols-[minmax(120px,1fr)_180px]">
                      <div className="flex flex-col gap-1.5">
                        <Input
                          value={d.term}
                          onChange={(e) => setDraft(t.id, { term: e.target.value })}
                          className="font-semibold"
                        />
                        <Select
                          value={d.strategy}
                          onValueChange={(v) => setDraft(t.id, { strategy: v ?? d.strategy })}
                        >
                          <SelectTrigger size="sm" className="w-full">
                            <SelectValue>{stratLabel(d.strategy)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STRATEGY_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={d.category}
                          onChange={(e) => setDraft(t.id, { category: e.target.value })}
                          placeholder="catégorie"
                          list="glossary-categories"
                          className="text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 sm:col-span-1">
                        <Textarea
                          value={d.glossFr}
                          onChange={(e) => setDraft(t.id, { glossFr: e.target.value })}
                          placeholder="glose FR"
                          className="min-h-16 sm:col-span-1"
                        />
                        <Input
                          value={d.note}
                          onChange={(e) => setDraft(t.id, { note: e.target.value })}
                          placeholder="NL/DE équivalents · marqueurs"
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex flex-row gap-2 lg:flex-col">
                      <Button
                        size="sm"
                        className="h-8 gap-1"
                        disabled={!dirty || savingId === t.id}
                        onClick={() => save(t)}
                      >
                        {savingId === t.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Save className="size-3.5" />
                        )}
                        Enregistrer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-destructive hover:text-destructive"
                        disabled={deletingId === t.id}
                        onClick={() => del(t)}
                      >
                        {deletingId === t.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
