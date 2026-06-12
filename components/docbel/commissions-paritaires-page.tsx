"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2Icon, Loader2Icon, SearchIcon } from "lucide-react";
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
  COMMISSION_TYPES,
  COMMISSION_TYPE_LABELS,
  type CommissionType,
} from "@/lib/commissions";
import {
  getCommissionsParitairesPayload,
  searchCommissions,
  type CommissionParitaire,
} from "@/lib/data-client";
import { GLASS_CARD, GLASS_INPUT } from "@/lib/glass-classes";

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

const TYPE_BADGE: Record<string, { bg: string; color: string }> = {
  commission_paritaire: { bg: "rgba(159, 124, 255, 0.18)", color: "#5a2a8c" },
  sous_commission_paritaire: { bg: "rgba(128, 176, 255, 0.18)", color: "#1d3a7a" },
  sous_secteur_officieux_ou_interne: {
    bg: "rgba(255, 200, 140, 0.22)",
    color: "#8a4f0a",
  },
};

function typeBadgeStyle(type: string) {
  return TYPE_BADGE[type] ?? { bg: "var(--glass-surface)", color: "var(--glass-ink-soft)" };
}

function typeLabel(type: string): string {
  if (type in COMMISSION_TYPE_LABELS) {
    return COMMISSION_TYPE_LABELS[type as CommissionType];
  }
  return type;
}

/// Valeur initiale de la recherche : préremplie depuis `?q=` (ex. teaser
/// « Quelle commission paritaire ? » de la landing employeur). Lecture directe
/// de window.location plutôt que useSearchParams : la page n'a pas de boundary
/// Suspense (cf. app/outils/commissions-paritaires/page.tsx) et le rendu
/// serveur retombe simplement sur "".
function initialSearchFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
}

export function CommissionsParitairesPage() {
  const [all, setAll] = useState<CommissionParitaire[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearchFromUrl);
  const [debounced, setDebounced] = useState(initialSearchFromUrl);
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
    currentPage * PAGE_SIZE,
  );

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of all) counts[item.type] = (counts[item.type] ?? 0) + 1;
    return counts;
  }, [all]);

  return (
    <section className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-3 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Référentiel
        </p>
        <div className="flex items-center gap-3">
          <span
            className="flex size-12 items-center justify-center rounded-2xl text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
            }}
          >
            <Building2Icon className="size-5" />
          </span>
          <h1 className="glass-display text-[36px] font-semibold leading-[1.05] sm:text-[44px]">
            Commissions paritaires belges
          </h1>
        </div>
        <p className="max-w-2xl text-[14px] text-[color:var(--glass-ink-soft)]">
          Liste officielle des commissions paritaires (CP) et sous-commissions,
          basée sur les données publiées par le{" "}
          <a
            href="https://emploi.belgique.be"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
          >
            SPF Emploi
          </a>{" "}
          et{" "}
          <a
            href="https://salairesminimums.be/jc_overview.html"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
          >
            salairesminimums.be
          </a>
          .
        </p>
        {lastUpdated ? (
          <p className="text-[12px] text-[color:var(--glass-ink-faint)]">
            Dernière mise à jour : {formatDate(lastUpdated)}
          </p>
        ) : null}
      </header>

      {!loading && all.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Total" value={all.length} />
          {COMMISSION_TYPES.map((t) => (
            <StatTile
              key={t}
              label={COMMISSION_TYPE_LABELS[t]}
              value={stats[t] ?? 0}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par code, numéro ou nom (ex: 124, horeca)…"
            className={`${GLASS_INPUT} h-11 pl-11`}
            // Avec ?q=, le serveur rend value="" et le client la valeur du
            // paramètre : écart attendu, on coupe juste l'avertissement.
            suppressHydrationWarning
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v as CommissionType | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className={`${GLASS_INPUT} h-11 sm:w-[260px]`}>
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

      <Card className={GLASS_CARD}>
        <CardContent className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow
                  className="hover:bg-transparent"
                  style={{ borderBottomColor: "var(--glass-ink-line)" }}
                >
                  <TableHead className="w-[110px] text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
                    Numéro
                  </TableHead>
                  <TableHead className="w-[200px] text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
                    Type
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
                    Nom
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-16 text-center">
                      <Loader2Icon className="inline size-5 animate-spin text-[color:var(--glass-ink-soft)]" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <SearchIcon className="size-5 text-[color:var(--glass-ink-faint)]" />
                        <p className="text-[13px] font-semibold">
                          Aucun résultat
                        </p>
                        <p className="text-[12px] text-[color:var(--glass-ink-soft)]">
                          Essayez un autre terme ou changez de type.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((c) => {
                    const badge = typeBadgeStyle(c.type);
                    return (
                      <TableRow
                        key={c.code}
                        style={{ borderBottomColor: "var(--glass-ink-line)" }}
                      >
                        <TableCell className="font-mono text-[13px] text-[color:var(--glass-ink)]">
                          {c.numero}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className="rounded-full border-0 px-2.5 py-0.5 text-[10px] font-bold"
                            style={{
                              background: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {typeLabel(c.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[13px] text-[color:var(--glass-ink)]">
                          {c.nom}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {!loading && filtered.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""} · Page{" "}
            {currentPage} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
            >
              Suivant
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className={GLASS_CARD}>
      <CardContent className="p-5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-soft)]">
          {label}
        </p>
        <p className="glass-display mt-1 text-[28px] font-semibold leading-none">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
