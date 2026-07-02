"use client";

/**
 * Client de recherche du corpus légal RioLex (réglementation chômage).
 * Espace partenaire (ProShell / shadcn) — recherche hybride via
 * /api/partenaire/reglementation/search : plein texte + sémantique (RRF).
 *
 * Sécurité : le surlignage `ts_headline` arrive avec des balises <mark> ;
 * on les reconstruit en JSX (jamais de dangerouslySetInnerHTML).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, ExternalLink, Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ResultItem {
  id: string;
  riolexId: string;
  title: string;
  loi: string;
  natureJuridique: string;
  articleNumber: string;
  abroge: boolean;
  statut: string | null;
  dateEntreeVigueur: string | null;
  datePublication: string | null;
  sourceUrl: string | null;
  headline: string | null;
}

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

/** Reconstruit les <mark> de ts_headline en JSX sûr (texte pur ailleurs). */
function renderHeadline(headline: string) {
  const parts = headline.split(/<\/?mark>/);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="rounded-sm bg-primary/15 px-0.5 font-medium text-primary"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function ReglementationSearchClient() {
  const t = useTranslations("public.pro");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [nature, setNature] = useState(searchParams.get("nature") ?? ALL);
  const [statut, setStatut] = useState(searchParams.get("statut") ?? ALL);
  const [loi, setLoi] = useState(searchParams.get("loi") ?? ALL);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchResults = useCallback(
    async (query: string, n: string, s: string, l: string, p: number) => {
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
      fetchResults(q.trim(), nature, statut, loi, page);
      // Reflète l'état dans l'URL (partage / retour arrière), sans navigation.
      const url = new URLSearchParams();
      if (q.trim()) url.set("q", q.trim());
      if (nature !== ALL) url.set("nature", nature);
      if (statut !== ALL) url.set("statut", statut);
      if (loi !== ALL) url.set("loi", loi);
      const qs = url.toString();
      router.replace(`/partenaire/reglementation${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [q, nature, statut, loi, page, fetchResults, router]);

  const onFilterChange =
    (setter: (v: string) => void) => (v: string | null) => {
      setter(v ?? ALL);
      setPage(1);
    };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
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
            className="pl-9"
            autoFocus
          />
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
        </div>
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
          {(data?.results ?? []).map((item) => (
            <Card key={item.id} className="transition-colors hover:bg-accent/40">
              <CardContent className="space-y-1.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/partenaire/reglementation/${encodeURIComponent(item.riolexId)}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {item.title}
                  </Link>
                  {item.abroge && (
                    <Badge variant="destructive">{t("reglAbroge")}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{item.loi}</Badge>
                  <Badge variant="secondary">
                    Art. {item.articleNumber}
                  </Badge>
                  {item.dateEntreeVigueur && (
                    <span>EV {item.dateEntreeVigueur}</span>
                  )}
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <ExternalLink className="size-3" aria-hidden />
                      RioLex
                    </a>
                  )}
                </div>
                {item.headline && (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {renderHeadline(item.headline)}
                  </p>
                )}
              </CardContent>
            </Card>
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

      <p className="text-xs text-muted-foreground">{t("reglNotice")}</p>
    </div>
  );
}
