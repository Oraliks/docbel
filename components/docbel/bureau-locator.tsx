"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  Loader2,
  AlertCircle,
  List,
  Map as MapIcon,
  Crosshair,
  Search,
} from "lucide-react";
import type { SerializedBureau } from "@/lib/bureaus/types";
import type { ResolveResult } from "@/lib/bureaus/resolve";
import { cn } from "@/lib/utils";
import { BureauCard } from "./bureau-card";

const BureauMap = dynamic(() => import("./bureau-map").then((m) => m.BureauMap), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] text-sm">
      Chargement de la carte...
    </div>
  ),
});

type Props = {
  accent: string;
  initialFocus?: "ONEM" | "SYNDICAT" | "ALL";
};

export function BureauLocator({ accent, initialFocus = "ALL" }: Props) {
  const [cp, setCp] = useState("");
  const [debouncedCp, setDebouncedCp] = useState("");
  const [textQuery, setTextQuery] = useState("");
  const [debouncedTextQuery, setDebouncedTextQuery] = useState("");
  const [data, setData] = useState<ResolveResult | null>(null);
  const [textResults, setTextResults] = useState<SerializedBureau[]>([]);
  const [loading, setLoading] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [geoBusy, setGeoBusy] = useState(false);

  // Pré-remplissage profil utilisateur
  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const pc = j?.postalCode;
        if (typeof pc === "string" && /^\d{4}$/.test(pc)) {
          setCp(pc);
          setDebouncedCp(pc);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce CP
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedCp(cp.trim()), 400);
    return () => window.clearTimeout(t);
  }, [cp]);

  // Debounce text search
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedTextQuery(textQuery.trim()), 400);
    return () => window.clearTimeout(t);
  }, [textQuery]);

  // Fetch resolve par CP
  const fetchResolve = useCallback(async (postal: string) => {
    if (!/^\d{4}$/.test(postal)) {
      setData(null);
      setErr(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/bureaus/resolve?cp=${encodeURIComponent(postal)}`);
      if (!res.ok) throw new Error("Erreur réseau");
      const j: ResolveResult = await res.json();
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchResolve(debouncedCp);
  }, [debouncedCp, fetchResolve]);

  // Recherche libre (nom / ville) — uniquement quand pas de CP saisi
  useEffect(() => {
    let cancelled = false;
    if (!debouncedTextQuery || debouncedTextQuery.length < 3 || debouncedCp) {
      setTextResults([]);
      return;
    }
    setTextLoading(true);
    fetch(`/api/bureaus?q=${encodeURIComponent(debouncedTextQuery)}&limit=20`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setTextResults(Array.isArray(j.items) ? j.items : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedTextQuery, debouncedCp]);

  // Géolocalisation → reverse geocode (proxifié)
  const requestGeo = useCallback(() => {
    if (!navigator.geolocation) {
      setErr("Géolocalisation indisponible");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(
            `/api/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          if (!r.ok) throw new Error("Reverse geocoding indisponible");
          const j = await r.json();
          const pc = j?.data?.address?.postcode;
          if (typeof pc === "string" && /^\d{4}$/.test(pc)) {
            setCp(pc);
            setDebouncedCp(pc);
            setTextQuery("");
          } else {
            setErr("Code postal introuvable depuis la géoloc.");
          }
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Erreur");
        } finally {
          setGeoBusy(false);
        }
      },
      () => {
        setGeoBusy(false);
        setErr("Permission de géolocalisation refusée");
      },
      { timeout: 10_000 }
    );
  }, []);

  // Liste pour la carte
  const allBureaus = useMemo(() => {
    if (debouncedCp && data) {
      const res: SerializedBureau[] = [];
      if (data.attitre.cpas) res.push(data.attitre.cpas);
      if (data.attitre.commune) res.push(data.attitre.commune);
      if (data.attitre.onem) res.push(data.attitre.onem);
      res.push(...data.proximite.syndicats);
      res.push(...data.proximite.permanences);
      res.push(...data.proximite.autres);
      return res;
    }
    return textResults;
  }, [debouncedCp, data, textResults]);

  const showResolveResults = !!debouncedCp && !!data;
  const showTextResults = !debouncedCp && debouncedTextQuery.length >= 3;
  const showInitialPrompt = !debouncedCp && !debouncedTextQuery;

  return (
    <div className="flex flex-col gap-4">
      {/* Champ CP + bouton géoloc */}
      <div>
        <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
          Votre code postal
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              value={cp}
              onChange={(e) => {
                setCp(e.target.value.replace(/\D/g, "").slice(0, 4));
                if (e.target.value) setTextQuery("");
              }}
              placeholder="ex : 1000"
              inputMode="numeric"
              className="w-full px-3.5 py-2.5 rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--input)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--ring)]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            {loading && (
              <Loader2
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]"
              />
            )}
          </div>
          <button
            type="button"
            onClick={requestGeo}
            disabled={geoBusy}
            className="px-3 rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--input)] cursor-pointer disabled:cursor-wait flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: accent }}
            title="Utiliser ma position"
          >
            {geoBusy ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
            Ma position
          </button>
        </div>
        {data?.commune && (
          <div className="mt-1.5 text-xs text-[var(--text-muted)]">
            <MapPin size={12} className="inline mr-1" />
            <strong>{data.commune.nameFr}</strong>
            {data.commune.nameNl ? ` · ${data.commune.nameNl}` : ""} ·{" "}
            {regionLabelFr(data.commune.region)}
          </div>
        )}
      </div>

      {/* Recherche par nom/ville (alternative au CP) */}
      <div>
        <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
          Ou recherchez par nom ou ville
        </label>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            value={textQuery}
            onChange={(e) => {
              setTextQuery(e.target.value);
              if (e.target.value) {
                setCp("");
              }
            }}
            placeholder="ex : CPAS Liège, FGTB Mons, Gent…"
            className="w-full pl-9 pr-3 py-2 rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--input)] text-[var(--foreground)] text-sm outline-none"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
          {textLoading && (
            <Loader2
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]"
            />
          )}
        </div>
      </div>

      {err && (
        <div className="px-3 py-2.5 rounded-[10px] bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle size={16} /> {err}
        </div>
      )}

      {data?.warnings?.map((w, i) => (
        <div
          key={i}
          className="px-3 py-2.5 rounded-[10px] bg-amber-100/30 border border-amber-300/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2"
        >
          <AlertCircle size={16} /> {w}
        </div>
      ))}

      {/* Toggle Liste / Carte */}
      {allBureaus.length > 0 && (
        <div className="inline-flex bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-0.5 self-start">
          <ToggleBtn active={view === "list"} onClick={() => setView("list")} accent={accent}>
            <List size={12} /> Liste
          </ToggleBtn>
          <ToggleBtn active={view === "map"} onClick={() => setView("map")} accent={accent}>
            <MapIcon size={12} /> Carte
          </ToggleBtn>
        </div>
      )}

      {/* Vue Carte */}
      {view === "map" && allBureaus.length > 0 && (
        <BureauMap
          bureaus={allBureaus}
          center={
            data?.commune?.lat && data?.commune?.lng
              ? { lat: data.commune.lat, lng: data.commune.lng }
              : undefined
          }
        />
      )}

      {/* Résultats : par CP */}
      {view === "list" && showResolveResults && (
        <>
          {(data!.attitre.cpas || data!.attitre.commune || data!.attitre.onem) && (
            <Section
              title="Vos bureaux attitrés"
              subtitle="Compétents pour votre commune. C'est ici que vous devez aller."
              accent={accent}
            >
              {data!.attitre.cpas && (
                <BureauCard bureau={data!.attitre.cpas} accent={accent} attitre label="CPAS" />
              )}
              {data!.attitre.commune && (
                <BureauCard
                  bureau={data!.attitre.commune}
                  accent={accent}
                  attitre
                  label="Maison communale"
                />
              )}
              {data!.attitre.onem && (
                <BureauCard
                  bureau={data!.attitre.onem}
                  accent={accent}
                  attitre
                  label="ONEM compétent"
                />
              )}
            </Section>
          )}

          {(data!.proximite.syndicats.length > 0 ||
            data!.proximite.permanences.length > 0 ||
            data!.proximite.autres.length > 0) && (
            <Section
              title="À proximité — libre choix"
              subtitle="Triés par distance. Sélectionnez celui qui vous convient."
              accent={accent}
            >
              {(initialFocus === "SYNDICAT" || initialFocus === "ALL") &&
                data!.proximite.syndicats.map((b) => (
                  <BureauCard key={b.id} bureau={b} accent={accent} label="Syndicat" />
                ))}
              {data!.proximite.permanences.map((b) => (
                <BureauCard key={b.id} bureau={b} accent={accent} label="Permanence" />
              ))}
              {data!.proximite.autres.map((b) => (
                <BureauCard key={b.id} bureau={b} accent={accent} />
              ))}
            </Section>
          )}

          {!data!.attitre.cpas &&
            !data!.attitre.commune &&
            !data!.attitre.onem &&
            data!.proximite.syndicats.length === 0 &&
            data!.proximite.permanences.length === 0 &&
            data!.proximite.autres.length === 0 && (
              <EmptyState text="Aucun bureau référencé pour ce code postal." />
            )}
        </>
      )}

      {/* Résultats : recherche libre */}
      {view === "list" && showTextResults && (
        <Section
          title={`Résultats : "${debouncedTextQuery}"`}
          subtitle={`${textResults.length} bureau${textResults.length > 1 ? "x" : ""} trouvé${
            textResults.length > 1 ? "s" : ""
          }`}
          accent={accent}
        >
          {textResults.length === 0 && !textLoading ? (
            <EmptyState text="Aucun bureau trouvé pour cette recherche." />
          ) : (
            textResults.map((b) => <BureauCard key={b.id} bureau={b} accent={accent} />)
          )}
        </Section>
      )}

      {showInitialPrompt && (
        <EmptyState text="Entrez votre code postal ou recherchez un bureau par nom." />
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  accent,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-md text-[11.5px] font-semibold inline-flex items-center gap-1 transition-colors",
        active ? "text-white" : "text-[var(--text-muted)]"
      )}
      style={active ? { backgroundColor: accent } : undefined}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2">
        <div className="text-[13px] font-bold text-[var(--foreground)] flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: accent }}
          />
          {title}
        </div>
        <div className="text-[11.5px] text-[var(--text-muted)] mt-0.5">{subtitle}</div>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-6 text-[var(--text-muted)] text-sm">{text}</div>
  );
}

function regionLabelFr(r: string): string {
  switch (r) {
    case "wallonia":
      return "Wallonie";
    case "flanders":
      return "Flandre";
    case "brussels":
      return "Bruxelles-Capitale";
    case "germanophone":
      return "Communauté germanophone";
    default:
      return r;
  }
}
