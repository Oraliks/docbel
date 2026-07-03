"use client";

/**
 * Client de recherche du corpus légal RioLex (réglementation chômage).
 * Espace partenaire (ProShell / shadcn) — recherche hybride via
 * /api/partenaire/reglementation/search : plein texte + sémantique (RRF).
 *
 * Sécurité : le surlignage `ts_headline` arrive avec des balises <mark> ;
 * on les reconstruit en JSX via renderHeadline (jamais de dangerouslySetInnerHTML).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, Loader2, RotateCcw, Search, Sparkles, Info } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { THEMES } from "@/lib/reglementation/themes";
import type { ResultItem } from "./types";
import { ResultCard } from "./result-card";
import { RegLegend } from "./legend";
import { OPEN_PALETTE_EVENT } from "./command-palette";
import { PinsRecents } from "./pins-recents";

interface SearchResponse {
  mode: "liste" | "fts" | "hybride";
  results: ResultItem[];
  total: number;
  page: number;
  pageSize: number;
  lois: string[];
}

const PAGE_SIZE = 20;
const ALL = "all";

/** Tri côté client : naturalSort sur articleNumber (ex : "79", "79bis", "104"). */
function naturalSortByArticle(items: ResultItem[]): ResultItem[] {
  return [...items].sort((a, b) => {
    const numA = parseInt(a.articleNumber, 10);
    const numB = parseInt(b.articleNumber, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.articleNumber.localeCompare(b.articleNumber, "fr", {
      numeric: true,
    });
  });
}

export function ReglementationSearchClient() {
  const t = useTranslations("public.pro");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [nature, setNature] = useState(searchParams.get("nature") ?? ALL);
  const [statut, setStatut] = useState(searchParams.get("statut") ?? ALL);
  const [loi, setLoi] = useState(searchParams.get("loi") ?? ALL);
  const [reforme, setReforme] = useState(searchParams.get("reforme") === "1");
  const [theme, setTheme] = useState(searchParams.get("theme") ?? "");
  const [since, setSince] = useState(searchParams.get("since") ?? ALL);
  const [tri, setTri] = useState(searchParams.get("tri") ?? "pertinence");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchResults = useCallback(
    async (
      query: string,
      n: string,
      s: string,
      l: string,
      p: number,
      r: boolean,
      th: string,
      sn: string,
      tr: string,
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setFailed(false);
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (n !== ALL) params.set("nature", n);
      if (s !== ALL) params.set("statut", s);
      if (l !== ALL) params.set("loi", l);
      if (r) params.set("reforme", "1");
      if (th) params.set("theme", th);
      if (sn !== ALL) params.set("since", sn);
      if (tr === "recent") params.set("tri", "recent");
      params.set("page", String(p));
      params.set("pageSize", String(PAGE_SIZE));
      try {
        const res = await fetch(
          `/api/partenaire/reglementation/search?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData((await res.json()) as SearchResponse);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setFailed(true);
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    },
    [],
  );

  // Débounce sur la saisie ; fetch immédiat sur filtres/page.
  useEffect(() => {
    const handle = setTimeout(() => {
      fetchResults(q.trim(), nature, statut, loi, page, reforme, theme, since, tri);
      // Reflète l'état dans l'URL (partage / retour arrière), sans navigation.
      const url = new URLSearchParams();
      if (q.trim()) url.set("q", q.trim());
      if (nature !== ALL) url.set("nature", nature);
      if (statut !== ALL) url.set("statut", statut);
      if (loi !== ALL) url.set("loi", loi);
      if (reforme) url.set("reforme", "1");
      if (theme) url.set("theme", theme);
      if (since !== ALL) url.set("since", since);
      if (tri !== "pertinence") url.set("tri", tri);
      const qs = url.toString();
      router.replace(`/partenaire/reglementation${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [q, nature, statut, loi, reforme, theme, since, tri, page, fetchResults, router]);

  const onFilterChange =
    (setter: (v: string) => void) => (v: string | null) => {
      setter(v ?? ALL);
      setPage(1);
    };

  const handleReset = () => {
    setQ("");
    setNature(ALL);
    setStatut(ALL);
    setLoi(ALL);
    setReforme(false);
    setTheme("");
    setSince(ALL);
    setTri("pertinence");
    setPage(1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  // Tri côté client
  const displayResults =
    tri === "article" && data ? naturalSortByArticle(data.results) : data?.results ?? [];

  return (
    <div className="space-y-4">
      {/* Épingles + consultés récemment (localStorage) */}
      <PinsRecents />

      {/* Bandeau stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-3">
            <p className="text-2xl font-bold tabular-nums">
              {loading && !data ? "…" : (data?.total ?? "…")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("reglStatsArticles")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-2xl font-bold tabular-nums">
              {loading && !data ? "…" : (data?.lois.length ?? "…")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("reglStatsLois")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-sm font-semibold">{t("reglStatsHybrid")}</p>
            <p className="text-sm text-muted-foreground">
              {t("reglStatsHybridHint")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={t("reglSearchPlaceholder")}
            className="pl-9 pr-24"
          />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted sm:inline-flex"
            title={t("reglPaletteHint")}
          >
            <kbd className="font-sans">Ctrl</kbd>
            <kbd className="font-sans">K</kbd>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={loi} onValueChange={onFilterChange(setLoi)}>
            <SelectTrigger className="w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("reglLoiAll")}</SelectItem>
              {(data?.lois ?? []).map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={nature} onValueChange={onFilterChange(setNature)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("reglNatureAll")}</SelectItem>
              <SelectItem value="AR">AR</SelectItem>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="Loi-programme">Loi-programme</SelectItem>
              <SelectItem value="Loi">Loi</SelectItem>
              <SelectItem value="Arrete-loi">Arrêté-loi</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statut} onValueChange={onFilterChange(setStatut)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("reglStatutAll")}</SelectItem>
              <SelectItem value="vigueur">{t("reglStatutVigueur")}</SelectItem>
              <SelectItem value="abroge">{t("reglStatutAbroge")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={since} onValueChange={onFilterChange(setSince)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("reglSinceAll")}</SelectItem>
              <SelectItem value="2026">{t("reglSinceYear", { year: 2026 })}</SelectItem>
              <SelectItem value="2024">{t("reglSinceYear", { year: 2024 })}</SelectItem>
              <SelectItem value="2022">{t("reglSinceYear", { year: 2022 })}</SelectItem>
              <SelectItem value="2020">{t("reglSinceYear", { year: 2020 })}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tri} onValueChange={(v) => { setTri(v ?? "pertinence"); setPage(1); }}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pertinence">{t("reglTriPertinence")}</SelectItem>
              <SelectItem value="article">{t("reglTriArticle")}</SelectItem>
              <SelectItem value="recent">{t("reglTriRecent")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={reforme ? "default" : "outline"}
            size="sm"
            aria-pressed={reforme}
            onClick={() => { setReforme((v) => !v); setPage(1); }}
            className="gap-1.5"
          >
            <Sparkles className="size-3.5" aria-hidden />
            {t("reglReforme2026")}
          </Button>
          <Popover>
            <PopoverTrigger
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={t("reglTipsTitle")}
              aria-label={t("reglTipsTitle")}
            >
              <Info className="size-4" aria-hidden />
            </PopoverTrigger>
            <PopoverContent align="end" className="max-w-xs space-y-1.5 text-sm">
              <p className="font-medium">{t("reglTipsTitle")}</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  <code className="rounded bg-muted px-1">&quot;phrase exacte&quot;</code> — l’expression exacte
                </li>
                <li>
                  <code className="rounded bg-muted px-1">-mot</code> — exclut un mot
                </li>
                <li>
                  <code className="rounded bg-muted px-1">motA OR motB</code> — l’un ou l’autre
                </li>
                <li>
                  <code className="rounded bg-muted px-1">131bis</code> — saut direct à l’article
                </li>
              </ul>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="size-3.5" aria-hidden />
            {t("reglReset")}
          </Button>
        </div>
      </div>

      {/* Thématiques (hashtags) — filtres rapides par concept métier */}
      <div className="flex flex-wrap items-center gap-1.5">
        {THEMES.map((th) => {
          const active = theme === th.key;
          return (
            <button
              key={th.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setTheme(active ? "" : th.key);
                setPage(1);
              }}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                active
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              #{th.label}
            </button>
          );
        })}
      </div>

      {/* Compteur */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <BookOpen className="size-4" aria-hidden />
        )}
        {data ? t("reglCount", { count: data.total }) : "…"}
      </div>

      {/* Résultats */}
      {failed ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("reglError")}
          </CardContent>
        </Card>
      ) : loading && !data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : data && data.results.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">{t("reglEmpty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("reglEmptyHint")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {displayResults.map((item) => (
            <ResultCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("reglPrev")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("reglPageInfo", { page, pages: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t("reglNext")}
          </Button>
        </div>
      )}

      {/* Légende natures juridiques */}
      <RegLegend />

      <p className="text-xs text-muted-foreground">{t("reglNotice")}</p>
    </div>
  );
}
