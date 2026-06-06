"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  History,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatDateKey, normalizeName } from "@/lib/rendez-vous/history";

type HistoryEntry = {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  createdAt: string;
};

type Props = {
  isAdmin: boolean;
  defaultOrg: string | null;
  orgOptions: string[];
};

const MANAGE_URL = "/api/rendez-vous/history/manage";

export function RdvHistoryClient({ isAdmin, defaultOrg, orgOptions }: Props) {
  const [org, setOrg] = useState<string>(isAdmin ? "" : (defaultOrg ?? ""));
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const confirm = useConfirm();

  // Un partenaire a un périmètre fixe ; un admin doit choisir une organisation.
  const ready = isAdmin ? org !== "" : org !== "";

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!ready) return;
      setLoading(true);
      try {
        const res = await fetch(MANAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "list",
            org: isAdmin ? org : undefined,
          }),
          signal,
        });
        const data = (await res.json().catch(() => null)) as {
          entries?: HistoryEntry[];
          error?: string;
        } | null;
        if (!res.ok) {
          toast.error(data?.error ?? "Chargement impossible.");
          setEntries([]);
          return;
        }
        setEntries(data?.entries ?? []);
        setLoaded(true);
      } catch {
        if (!signal?.aborted) toast.error("Erreur réseau.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [isAdmin, org, ready],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const filtered = useMemo(() => {
    const q = normalizeName(search);
    if (!q) return entries;
    return entries.filter((e) => normalizeName(e.name).includes(q));
  }, [entries, search]);

  // Nombre de personnes distinctes (un même nom peut avoir plusieurs RDV).
  const distinctPeople = useMemo(
    () => new Set(entries.map((e) => normalizeName(e.name))).size,
    [entries],
  );

  const handleDelete = useCallback(
    async (entry: HistoryEntry) => {
      const ok = await confirm({
        title: "Supprimer cette entrée ?",
        description: `${entry.name} — ${formatDateKey(entry.date)} à ${entry.startTime}`,
        destructive: true,
        confirmText: "Supprimer",
      });
      if (!ok) return;
      try {
        const res = await fetch(MANAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            id: entry.id,
            org: isAdmin ? org : undefined,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          toast.error(data?.error ?? "Suppression impossible.");
          return;
        }
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        toast.success("Entrée supprimée.");
      } catch {
        toast.error("Erreur réseau.");
      }
    },
    [confirm, isAdmin, org],
  );

  const handleClear = useCallback(async () => {
    const ok = await confirm({
      title: "Vider tout l'historique ?",
      description:
        "Tous les rendez-vous enregistrés pour cette organisation seront définitivement supprimés. Cette action est irréversible.",
      destructive: true,
      confirmText: "Vider l'historique",
      requireText: "VIDER",
    });
    if (!ok) return;
    try {
      const res = await fetch(MANAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", org: isAdmin ? org : undefined }),
      });
      const data = (await res.json().catch(() => null)) as {
        deleted?: number;
        error?: string;
      } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "Action impossible.");
        return;
      }
      setEntries([]);
      toast.success(`${data?.deleted ?? 0} entrée(s) supprimée(s).`);
    } catch {
      toast.error("Erreur réseau.");
    }
  }, [confirm, isAdmin, org]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <History className="size-5 text-primary" />
          Historique des rendez-vous
        </h1>
        <p className="text-sm text-muted-foreground">
          Liste des rendez-vous enregistrés par le service. Sert à repérer les
          personnes ayant déjà pris un rendez-vous.
        </p>
        <Link
          href="/partenaire/outils/fgtb-planning"
          className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          Retour à l&apos;outil de conversion
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" />
            Rendez-vous enregistrés
          </CardTitle>
          <CardDescription>
            {loaded
              ? `${entries.length} rendez-vous • ${distinctPeople} personne${distinctPeople > 1 ? "s" : ""} distincte${distinctPeople > 1 ? "s" : ""}`
              : "Sélectionnez une organisation pour afficher l'historique."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            {isAdmin ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="org-select" className="text-xs">
                  Organisation
                </Label>
                <Select value={org} onValueChange={(v) => setOrg(v ?? "")}>
                  <SelectTrigger id="org-select" className="w-[260px]">
                    <SelectValue placeholder="Choisir une organisation…" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgOptions.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        Aucune organisation
                      </SelectItem>
                    ) : (
                      orgOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="search" className="text-xs">
                Rechercher un nom
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom ou prénom…"
                  className="pl-8"
                />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleClear}
              disabled={!ready || entries.length === 0}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 />
              Vider l&apos;historique
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Chargement…
            </div>
          ) : !ready ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Choisissez une organisation ci-dessus.
            </p>
          ) : filtered.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {entries.length === 0
                ? "Aucun rendez-vous enregistré pour le moment."
                : "Aucun résultat pour cette recherche."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Créneau</TableHead>
                  <TableHead>Enregistré le</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{formatDateKey(e.date)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {e.startTime} – {e.endTime}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString("fr-BE")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(e)}
                        title="Supprimer cette entrée"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
