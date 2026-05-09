"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, SearchIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  COMMISSION_TYPES,
  COMMISSION_TYPE_LABELS,
  type CommissionType,
} from "@/lib/commissions";
import {
  getCommissionsParitairesPayload,
  searchCommissions,
  type CommissionParitaire,
} from "@/lib/data-client";

const PAGE_SIZE = 15;

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function badgeForType(type: string): string {
  switch (type) {
    case "commission_paritaire":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200";
    case "sous_commission_paritaire":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    case "sous_secteur_officieux_ou_interne":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function typeLabel(type: string): string {
  if (type in COMMISSION_TYPE_LABELS) {
    return COMMISSION_TYPE_LABELS[type as CommissionType];
  }
  return type;
}

export function CommissionsParitairesPage() {
  const [all, setAll] = useState<CommissionParitaire[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [typeFilter, setTypeFilter] = useState<CommissionType | "ALL">("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await getCommissionsParitairesPayload();
        if (cancelled) return;
        setAll(payload.items);
        setLastUpdated(payload.lastUpdated);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    let list = all;
    if (typeFilter !== "ALL") {
      list = list.filter((c) => c.type === typeFilter);
    }
    if (debounced) {
      list = searchCommissions(list, debounced);
    }
    return list;
  }, [all, typeFilter, debounced]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of all) counts[item.type] = (counts[item.type] ?? 0) + 1;
    return counts;
  }, [all]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Building2 size={22} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Commissions paritaires belges
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Liste officielle des commissions paritaires (CP) et sous-commissions, basée sur les
          données publiées par le{" "}
          <a
            href="https://emploi.belgique.be"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            SPF Emploi
          </a>{" "}
          et{" "}
          <a
            href="https://salairesminimums.be/jc_overview.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            salairesminimums.be
          </a>
          .
        </p>
        {lastUpdated && (
          <p className="text-sm text-muted-foreground mt-2">
            Dernière mise à jour : {formatDate(lastUpdated)}
          </p>
        )}
      </div>

      {/* Stats */}
      {!loading && all.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold mt-1">{all.length}</p>
            </CardContent>
          </Card>
          {COMMISSION_TYPES.map((t) => (
            <Card key={t}>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {COMMISSION_TYPE_LABELS[t]}
                </p>
                <p className="text-2xl font-bold mt-1">{stats[t] ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        <div className="relative flex-1">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par code, numéro ou nom (ex: 124, horeca, transport)…"
            className="pl-9"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v as CommissionType | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-[240px]">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les types</SelectItem>
            {COMMISSION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {COMMISSION_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold w-[110px]">Numéro</TableHead>
                  <TableHead className="font-semibold w-[180px]">Type</TableHead>
                  <TableHead className="font-semibold">Nom</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-16">
                      <Loader2
                        className="inline animate-spin text-muted-foreground"
                        size={20}
                      />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-12">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <SearchIcon />
                          </EmptyMedia>
                          <EmptyTitle>Aucun résultat</EmptyTitle>
                          <EmptyDescription>
                            Essayez un autre terme ou changez de type.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((c) => (
                    <TableRow key={c.code} className="hover:bg-muted/40">
                      <TableCell className="font-mono">{c.numero}</TableCell>
                      <TableCell>
                        <Badge className={badgeForType(c.type)}>
                          {typeLabel(c.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.nom}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""} • Page {currentPage} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
