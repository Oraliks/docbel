"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Building2,
  ExternalLink,
  Eye,
  Globe,
  Loader2,
  MapPin,
  Phone,
  Search,
} from "lucide-react";
import { displayBureauName } from "@/lib/bureaus/format";

interface BureauResult {
  id: string;
  type: string;
  name: string;
  street: string;
  streetNum: string | null;
  postalCode: string;
  city: string;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  organismeCode: string | null;
  organismeName: string | null;
  organismeColor: string | null;
}

interface ResolveResponse {
  commune: {
    id: string;
    insCode: string;
    nameFr: string;
    region: string;
    province: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  attitre: {
    cpas: BureauResult | null;
    commune: BureauResult | null;
    onem: BureauResult | null;
    organismesPaiement: BureauResult[];
  };
  warnings: string[];
}

const PREVIEW_TYPES = ["CPAS", "COMMUNE", "ONEM", "SYNDICAT"];

/**
 * Preview "côté utilisateur" intégré à l'admin.
 *
 * Admin tape un CP → on appelle /api/bureaux/resolve (l'endpoint
 * public utilisé par le finder) → on affiche en miroir ce qu'un
 * citoyen verrait, sans tout le markup public lourd (cards uniformes
 * de luxe, animations, etc.).
 *
 * Objectif : tester en 2 secondes l'impact d'une modif (édition
 * bureau, nouvelle assignation territoriale, etc.) sans devoir
 * ouvrir /outils/bureaux dans un autre tab et reload.
 *
 * Bonus : affiche les `warnings` du resolver, qui ne sont pas
 * surfacés côté front mais utiles à l'admin (e.g. "CP X pas
 * référencé", "ONEM trouvé via fallback").
 */
export function PreviewFinder() {
  const t = useTranslations("admin.bureaux");
  const [cp, setCp] = useState("");
  const [data, setData] = useState<ResolveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Lookups rapides : suggérer 3 CPs pour test au premier render
  const QUICK_CPS = ["1000", "1030", "4000", "6000", "9000"];

  async function resolve(postalCode: string) {
    if (!/^\d{4}$/.test(postalCode)) {
      setData(null);
      setError(null);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/bureaux/resolve?cp=${postalCode}`, {
        signal: ac.signal,
      });
      if (!r.ok) throw new Error(t("resolveFailed"));
      const json = (await r.json()) as ResolveResponse;
      if (!ac.signal.aborted) setData(json);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : t("errorGeneric"));
      setData(null);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }

  // Debounce 200 ms
  useEffect(() => {
    const timer = setTimeout(() => void resolve(cp.trim()), 200);
    return () => clearTimeout(timer);
  }, [cp]); // eslint-disable-line react-hooks/exhaustive-deps

  const allBureaus = useMemo<BureauResult[]>(() => {
    if (!data) return [];
    return [
      data.attitre.onem,
      data.attitre.cpas,
      data.attitre.commune,
      ...data.attitre.organismesPaiement,
    ].filter((b): b is BureauResult => !!b);
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Input */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="size-4" /> {t("previewTitle")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("previewDescription")}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 h-10 w-fit focus-within:ring-2 focus-within:ring-ring">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                placeholder={t("cpExample")}
                value={cp}
                onChange={(e) => setCp(e.target.value.replace(/\D/g, ""))}
                className="border-0 px-0 h-auto text-sm font-medium tabular-nums shadow-none focus-visible:ring-0 bg-transparent w-[80px]"
              />
            </label>
            <Button
              render={
                <a
                  href={`/outils/bureaux${cp ? `?cp=${cp}` : ""}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {t("seeReal")} <ExternalLink className="size-3" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground">{t("quickTest")}</span>
            {QUICK_CPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCp(c)}
                className="px-2 py-0.5 rounded border bg-card hover:bg-muted tabular-nums transition"
              >
                {c}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* États */}
      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin mr-2" /> {t("resolving")}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Warnings du resolver */}
      {data && data.warnings.length > 0 && (
        <div className="rounded-md border border-orange-300 bg-orange-50/60 dark:bg-orange-950/10 p-3 text-xs text-orange-900 dark:text-orange-200 space-y-1">
          <p className="font-medium text-[11px] uppercase tracking-wider mb-1">
            {t("resolverWarnings")}
          </p>
          {data.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Commune résolue */}
      {data && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  {t("resolvedCommune")}
                </p>
                <h3 className="text-lg font-semibold">
                  {data.commune?.nameFr ?? "—"}
                </h3>
                {data.commune && (
                  <p className="text-xs text-muted-foreground">
                    INS {data.commune.insCode} · {data.commune.region}
                    {data.commune.province ? ` · ${data.commune.province}` : ""}
                  </p>
                )}
              </div>
              {data.commune?.lat != null && data.commune?.lng != null && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <MapPin className="size-3" />
                  {data.commune.lat.toFixed(3)}, {data.commune.lng.toFixed(3)}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des bureaux retournés */}
      {data && allBureaus.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("bureausReturned", { count: allBureaus.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {allBureaus.map((b) => (
              <PreviewBureauRow key={b.id} bureau={b} />
            ))}
          </CardContent>
        </Card>
      )}

      {data && allBureaus.length === 0 && (
        <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
          {t("noBureauResolved")}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

function PreviewBureauRow({ bureau }: { bureau: BureauResult }) {
  const t = useTranslations("admin.bureaux");
  const typeLabel = PREVIEW_TYPES.includes(bureau.type)
    ? t(`previewType_${bureau.type}` as Parameters<typeof t>[0])
    : bureau.type;
  const accent = bureau.organismeColor ?? "#5E3A8E";
  return (
    <div className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/30 transition">
      {/* Pastille type */}
      <div
        className="size-8 rounded-md shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
        style={{ background: accent }}
        title={bureau.organismeName ?? typeLabel}
      >
        <Building2 className="size-4" />
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="outline" className="text-[10px]">
            {typeLabel}
          </Badge>
          {bureau.organismeCode && bureau.type === "SYNDICAT" && (
            <Badge
              variant="outline"
              className="text-[10px] uppercase"
              style={{ borderColor: accent, color: accent }}
            >
              {bureau.organismeCode}
            </Badge>
          )}
          {bureau.lat === null && (
            <Badge variant="destructive" className="text-[10px] gap-1">
              <MapPin className="size-2.5" /> {t("noCoords")}
            </Badge>
          )}
        </div>
        <p className="text-sm font-semibold leading-tight truncate">
          {displayBureauName(bureau)}
        </p>
        <p className="text-xs text-muted-foreground leading-snug truncate">
          {bureau.street}
          {bureau.streetNum ? ` ${bureau.streetNum}` : ""}, {bureau.postalCode} {bureau.city}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] pt-0.5 text-muted-foreground">
          {bureau.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3" /> {bureau.phone}
            </span>
          )}
          {bureau.website && (
            <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
              <Globe className="size-3" /> {bureau.website.replace(/^https?:\/\//, "")}
            </span>
          )}
        </div>
      </div>

      {/* Lien admin */}
      <Button
        render={<a href="#annuaire" title={t("editInDirectory")} />}
        variant="ghost"
        size="sm"
        className="shrink-0 h-7 text-[11px] gap-1"
      >
        <ExternalLink className="size-3" />
        {t("edit")}
      </Button>
    </div>
  );
}
