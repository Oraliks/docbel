"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  Loader2,
  AlertCircle,
  Map as MapIcon,
  Crosshair,
  Search,
  X,
  UserCheck,
  Sparkles,
} from "lucide-react";
import type { SerializedBureau } from "@/lib/bureaus/types";
import type { ResolveResult } from "@/lib/bureaus/resolve";
import type { AddressSuggestion } from "@/app/api/geocode/suggest/route";
import { cn } from "@/lib/utils";
import { BureauCard, BureauCardSkeleton } from "./bureau-card";
import { WizardPanel } from "./bureau-wizard";

const BureauMap = dynamic(() => import("./bureau-map").then((m) => m.BureauMap), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] lg:h-full rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] text-sm">
      Chargement de la carte...
    </div>
  ),
});

type Props = {
  accent: string;
  initialFocus?: "ONEM" | "SYNDICAT" | "ALL";
};

type UserPrefs = {
  postalCode: string | null;
  organismePaiement: string | null;
  commissionParitaireCode: string | null;
  mutuelleCode: string | null;
};

// Détecte si une chaîne ressemble à une adresse (a un chiffre OU un mot-clé voirie)
const ADDRESS_KEYWORDS = /\b(rue|avenue|chauss[ée]e|boulevard|place|chemin|impasse|allée|square|quai|drève|straat|laan|weg|plein|steenweg)\b/i;
function looksLikeAddress(s: string): boolean {
  if (s.length < 4) return false;
  if (/^\d{4}$/.test(s)) return false; // CP pur → on ne géocode pas
  return /\d/.test(s) || ADDRESS_KEYWORDS.test(s);
}

export function BureauLocator({ accent }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [data, setData] = useState<ResolveResult | null>(null);
  const [textResults, setTextResults] = useState<SerializedBureau[]>([]);
  const [loading, setLoading] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showMapMobile, setShowMapMobile] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [addrSuggestions, setAddrSuggestions] = useState<AddressSuggestion[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrFocused, setAddrFocused] = useState(false);
  const [prefs, setPrefs] = useState<UserPrefs>({
    postalCode: null,
    organismePaiement: null,
    commissionParitaireCode: null,
    mutuelleCode: null,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsBoxRef = useRef<HTMLDivElement>(null);

  // Détection : 4 chiffres → CP, sinon texte
  const isPostalCode = /^\d{4}$/.test(debouncedQuery.trim());
  const textQuery = !isPostalCode && debouncedQuery.trim().length >= 3 ? debouncedQuery.trim() : "";

  // Pré-remplissage depuis le profil utilisateur
  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        const next: UserPrefs = {
          postalCode: typeof j?.postalCode === "string" ? j.postalCode : null,
          organismePaiement: typeof j?.organismePaiement === "string" ? j.organismePaiement : null,
          commissionParitaireCode:
            typeof j?.commissionParitaireCode === "string" ? j.commissionParitaireCode : null,
          mutuelleCode: typeof j?.mutuelleCode === "string" ? j.mutuelleCode : null,
        };
        setPrefs(next);
        if (next.postalCode && /^\d{4}$/.test(next.postalCode) && !query) {
          setQuery(next.postalCode);
          setDebouncedQuery(next.postalCode);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce 350ms
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  // Fetch resolve quand on a un CP
  const fetchResolve = useCallback(
    async (cp: string, p: UserPrefs) => {
      if (!/^\d{4}$/.test(cp)) {
        setData(null);
        setErr(null);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams({ cp });
        if (p.organismePaiement) params.set("org", p.organismePaiement);
        if (p.commissionParitaireCode) params.set("commission", p.commissionParitaireCode);
        if (p.mutuelleCode) params.set("mutuelle", p.mutuelleCode);
        const res = await fetch(`/api/bureaux/resolve?${params}`);
        if (!res.ok) throw new Error("Erreur réseau");
        const j: ResolveResult = await res.json();
        setData(j);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erreur");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isPostalCode) {
      void fetchResolve(debouncedQuery.trim(), prefs);
    } else {
      setData(null);
    }
  }, [debouncedQuery, isPostalCode, fetchResolve, prefs]);

  // Recherche libre par texte (sur les bureaux)
  useEffect(() => {
    let cancelled = false;
    if (!textQuery) {
      setTextResults([]);
      return;
    }
    setTextLoading(true);
    fetch(`/api/bureaux?q=${encodeURIComponent(textQuery)}&limit=20`)
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
  }, [textQuery]);

  // Suggestions d'adresses BE — seulement si la query ressemble à une adresse
  useEffect(() => {
    let cancelled = false;
    const q = debouncedQuery.trim();
    if (!looksLikeAddress(q)) {
      setAddrSuggestions([]);
      return;
    }
    setAddrLoading(true);
    fetch(`/api/geocode/suggest?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setAddrSuggestions(Array.isArray(j.items) ? j.items : []);
      })
      .catch(() => {
        if (!cancelled) setAddrSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setAddrLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Fermer la liste si on clique en dehors
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (
        suggestionsBoxRef.current &&
        !suggestionsBoxRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setAddrFocused(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Retire une préférence
  const clearPref = useCallback((key: keyof UserPrefs) => {
    setPrefs((p) => ({ ...p, [key]: null }));
    fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: null }),
    }).catch(() => {});
  }, []);

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
            setQuery(pc);
            setDebouncedQuery(pc);
            inputRef.current?.blur();
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

  const pickSuggestion = useCallback((s: AddressSuggestion) => {
    if (s.postcode && /^\d{4}$/.test(s.postcode)) {
      setQuery(s.postcode);
      setDebouncedQuery(s.postcode);
      setAddrSuggestions([]);
      setAddrFocused(false);
      inputRef.current?.blur();
    }
  }, []);

  // Liste agrégée pour la carte
  const allBureaus = useMemo(() => {
    if (isPostalCode && data) {
      const res: SerializedBureau[] = [];
      if (data.attitre.cpas) res.push(data.attitre.cpas);
      if (data.attitre.commune) res.push(data.attitre.commune);
      if (data.attitre.onem) res.push(data.attitre.onem);
      if (data.attitre.organismePaiement) res.push(data.attitre.organismePaiement);
      if (data.attitre.mutuelle) res.push(data.attitre.mutuelle);
      res.push(...data.sectoriel.commissionRelated);
      res.push(...data.proximite.syndicats);
      res.push(...data.proximite.permanences);
      res.push(...data.proximite.autres);
      return Array.from(new Map(res.map((b) => [b.id, b])).values());
    }
    return textResults;
  }, [isPostalCode, data, textResults]);

  const hasResults = (isPostalCode && data) || textResults.length > 0;
  const isInitial = !debouncedQuery && !loading && !textLoading;
  const showSuggestions = addrFocused && (addrSuggestions.length > 0 || addrLoading);

  // Si wizard ouvert → on l'affiche seul (full focus). Pas de hero, pas de search, pas de results.
  if (wizardOpen) {
    return (
      <div className="flex flex-col gap-4">
        <WizardPanel
          accent={accent}
          initialPostalCode={prefs.postalCode ?? (isPostalCode ? debouncedQuery : "")}
          initialOrganismePaiement={prefs.organismePaiement}
          initialCommissionCode={prefs.commissionParitaireCode}
          onClose={() => setWizardOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Hero (état initial) : wizard primaire, recherche optionnelle */}
      {isInitial && !searchExpanded && (
        <HeroInitial
          accent={accent}
          onWizard={() => setWizardOpen(true)}
          onExpandSearch={() => {
            setSearchExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
        />
      )}

      {/* Header : input unifié + wizard CTA + géoloc */}
      <div
        className={cn(
          "flex flex-col gap-2",
          isInitial && !searchExpanded ? "hidden" : ""
        )}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = accent;
                setAddrFocused(true);
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              placeholder="Adresse, code postal, ou nom de bureau"
              className="w-full pl-10 pr-9 py-3 rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--input)] text-[var(--foreground)] text-sm outline-none transition-colors"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            />
            {query && !loading && !textLoading && !addrLoading && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setDebouncedQuery("");
                  setData(null);
                  setTextResults([]);
                  setAddrSuggestions([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--foreground)]"
              >
                <X size={14} />
              </button>
            )}
            {(loading || textLoading || addrLoading) && (
              <Loader2
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]"
              />
            )}

            {/* Dropdown suggestions d'adresses BE */}
            {showSuggestions && (
              <div
                ref={suggestionsBoxRef}
                className="absolute z-30 top-full left-0 right-0 mt-1.5 rounded-xl border border-[var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)] shadow-lg ring-1 ring-foreground/5 overflow-hidden"
              >
                <div className="px-3 py-2 text-[11px] uppercase tracking-wide font-bold text-[var(--text-muted)] border-b border-[var(--border)]/60 flex items-center gap-1.5">
                  <MapPin size={11} style={{ color: accent }} />
                  Adresses en Belgique
                </div>
                {addrLoading && addrSuggestions.length === 0 && (
                  <div className="px-3 py-3 text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" /> Recherche…
                  </div>
                )}
                {addrSuggestions.map((s, i) => (
                  <button
                    key={`${s.lat}-${s.lng}-${i}`}
                    type="button"
                    onMouseDown={(e) => {
                      // Empêche le blur de l'input avant le clic
                      e.preventDefault();
                    }}
                    onClick={() => pickSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)] transition-colors flex items-center gap-2 border-b border-[var(--border)]/40 last:border-b-0"
                  >
                    <MapPin size={13} className="text-[var(--text-muted)] shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{s.label}</span>
                    {s.postcode && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: `${accent}18`, color: accent }}
                      >
                        CP {s.postcode}
                      </span>
                    )}
                  </button>
                ))}
                {!addrLoading && addrSuggestions.length === 0 && (
                  <div className="px-3 py-3 text-xs text-[var(--text-muted)]">
                    Aucune adresse trouvée en Belgique.
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={requestGeo}
            disabled={geoBusy}
            className="hidden sm:inline-flex px-3 rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--input)] items-center gap-1.5 text-xs font-semibold disabled:cursor-wait hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: accent }}
            title="Utiliser ma position"
          >
            {geoBusy ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
            Ma position
          </button>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="hidden md:inline-flex px-3 rounded-xl items-center gap-1.5 text-xs font-bold text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: accent }}
          >
            <Sparkles size={14} />
            Aide-moi
          </button>
        </div>

        {/* Strip mobile : géoloc + wizard */}
        <div className="flex gap-2 sm:hidden">
          <button
            type="button"
            onClick={requestGeo}
            disabled={geoBusy}
            className="flex-1 py-2 rounded-lg border border-[var(--border)] bg-[var(--input)] inline-flex items-center justify-center gap-1.5 text-xs font-semibold"
            style={{ color: accent }}
          >
            {geoBusy ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
            Ma position
          </button>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="flex-1 py-2 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            <Sparkles size={12} /> Aide-moi
          </button>
        </div>

        {/* Strip de contexte : commune + prefs */}
        {(data?.commune ||
          prefs.organismePaiement ||
          prefs.commissionParitaireCode ||
          prefs.mutuelleCode) && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            {data?.commune && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] px-2 py-0.5">
                <MapPin size={11} />
                <strong className="text-[var(--foreground)]">{data.commune.nameFr}</strong>
                {data.commune.nameNl && ` · ${data.commune.nameNl}`} ·{" "}
                {regionLabelFr(data.commune.region)}
              </span>
            )}
            {prefs.organismePaiement && (
              <PrefChip
                icon={<UserCheck size={11} />}
                label={`Org. paiement : ${prefs.organismePaiement.toUpperCase()}`}
                onClear={() => clearPref("organismePaiement")}
                accent={accent}
              />
            )}
            {prefs.commissionParitaireCode && (
              <PrefChip
                label={`CP ${prefs.commissionParitaireCode}`}
                onClear={() => clearPref("commissionParitaireCode")}
                accent={accent}
              />
            )}
            {prefs.mutuelleCode && (
              <PrefChip
                label={`Mutuelle : ${prefs.mutuelleCode}`}
                onClear={() => clearPref("mutuelleCode")}
                accent={accent}
              />
            )}
          </div>
        )}
      </div>

      {/* Erreur + warnings */}
      {err && (
        <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle size={14} /> {err}
        </div>
      )}
      {data?.warnings?.map((w, i) => (
        <div
          key={i}
          className="px-3 py-2.5 rounded-lg bg-amber-100/30 border border-amber-300/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2"
        >
          <AlertCircle size={14} /> {w}
        </div>
      ))}

      {/* Vue principale : split desktop, stack mobile */}
      <div
        className={cn(
          "gap-4",
          hasResults && allBureaus.length > 0
            ? "grid grid-cols-1 lg:grid-cols-[1fr_400px]"
            : ""
        )}
      >
        {/* Colonne résultats */}
        <div className="flex flex-col gap-4">
          {/* Skeleton */}
          {loading && !data && (
            <>
              <SectionHeader
                title="Vos bureaux attitrés"
                subtitle="Chargement..."
                accent={accent}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <BureauCardSkeleton variant="attitre" />
                <BureauCardSkeleton variant="attitre" />
                <BureauCardSkeleton variant="attitre" />
              </div>
            </>
          )}

          {/* Résultats par CP */}
          {isPostalCode && data && !loading && (
            <>
              {(data.attitre.cpas ||
                data.attitre.commune ||
                data.attitre.onem ||
                data.attitre.organismePaiement ||
                data.attitre.mutuelle) && (
                <>
                  <SectionHeader
                    title="Vos bureaux attitrés"
                    subtitle="Compétents pour votre commune. C'est ici que vous devez aller."
                    accent={accent}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.attitre.cpas && (
                      <BureauCard
                        bureau={data.attitre.cpas}
                        accent={accent}
                        variant="attitre"
                        label="CPAS"
                      />
                    )}
                    {data.attitre.commune && (
                      <BureauCard
                        bureau={data.attitre.commune}
                        accent={accent}
                        variant="attitre"
                        label="Commune"
                      />
                    )}
                    {data.attitre.onem && (
                      <BureauCard
                        bureau={data.attitre.onem}
                        accent={accent}
                        variant="attitre"
                        label="ONEM"
                      />
                    )}
                    {data.attitre.organismePaiement && (
                      <BureauCard
                        bureau={data.attitre.organismePaiement}
                        accent={accent}
                        variant="attitre"
                        label={prefs.organismePaiement?.toUpperCase()}
                      />
                    )}
                    {data.attitre.mutuelle && (
                      <BureauCard
                        bureau={data.attitre.mutuelle}
                        accent={accent}
                        variant="attitre"
                        label="Mutuelle"
                      />
                    )}
                  </div>
                </>
              )}

              {data.sectoriel.commissionRelated.length > 0 && (
                <>
                  <SectionHeader
                    title={`Sectoriel — CP ${prefs.commissionParitaireCode ?? ""}`}
                    subtitle="Bureaux qui gèrent les dossiers de votre commission paritaire."
                    accent={accent}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.sectoriel.commissionRelated.map((b) => (
                      <BureauCard key={b.id} bureau={b} accent={accent} label="Sectoriel" />
                    ))}
                  </div>
                </>
              )}

              {(data.proximite.syndicats.length > 0 ||
                data.proximite.permanences.length > 0 ||
                data.proximite.autres.length > 0) && (
                <>
                  <SectionHeader
                    title="À proximité"
                    subtitle="Libre choix · triés par distance."
                    accent={accent}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.proximite.syndicats.map((b) => (
                      <BureauCard key={b.id} bureau={b} accent={accent} label="Syndicat" />
                    ))}
                    {data.proximite.permanences.map((b) => (
                      <BureauCard key={b.id} bureau={b} accent={accent} label="Permanence" />
                    ))}
                    {data.proximite.autres.map((b) => (
                      <BureauCard key={b.id} bureau={b} accent={accent} />
                    ))}
                  </div>
                </>
              )}

              {!data.attitre.cpas &&
                !data.attitre.commune &&
                !data.attitre.onem &&
                data.proximite.syndicats.length === 0 &&
                data.proximite.permanences.length === 0 &&
                data.proximite.autres.length === 0 && <NoResultEmpty />}
            </>
          )}

          {/* Résultats texte */}
          {!isPostalCode && textQuery && !textLoading && (
            <>
              <SectionHeader
                title={`Résultats : "${textQuery}"`}
                subtitle={`${textResults.length} bureau${textResults.length > 1 ? "x" : ""} trouvé${
                  textResults.length > 1 ? "s" : ""
                }`}
                accent={accent}
              />
              {textResults.length === 0 ? (
                <NoResultEmpty />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {textResults.map((b) => (
                    <BureauCard key={b.id} bureau={b} accent={accent} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Colonne carte (desktop) */}
        {hasResults && allBureaus.length > 0 && (
          <div className="hidden lg:block lg:sticky lg:top-4 lg:h-[calc(100vh-140px)] lg:max-h-[640px]">
            <BureauMap
              bureaus={allBureaus}
              center={
                data?.commune?.lat && data?.commune?.lng
                  ? { lat: data.commune.lat, lng: data.commune.lng }
                  : undefined
              }
              height={undefined}
            />
          </div>
        )}
      </div>

      {/* Toggle mobile pour la carte */}
      {hasResults && allBureaus.length > 0 && (
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setShowMapMobile(!showMapMobile)}
            className="w-full py-2.5 rounded-lg border border-[var(--border)] inline-flex items-center justify-center gap-2 text-sm font-semibold"
            style={{ color: accent }}
          >
            <MapIcon size={14} /> {showMapMobile ? "Masquer la carte" : "Afficher la carte"}
          </button>
          {showMapMobile && (
            <div className="mt-3">
              <BureauMap
                bureaus={allBureaus}
                center={
                  data?.commune?.lat && data?.commune?.lng
                    ? { lat: data.commune.lat, lng: data.commune.lng }
                    : undefined
                }
                height={350}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PrefChip({
  icon,
  label,
  onClear,
  accent,
}: {
  icon?: React.ReactNode;
  label: string;
  onClear: () => void;
  accent: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border"
      style={{ borderColor: `${accent}40`, background: `${accent}10`, color: accent }}
    >
      {icon}
      {label}
      <button
        type="button"
        onClick={onClear}
        className="ml-0.5 opacity-60 hover:opacity-100"
        title="Retirer cette préférence"
      >
        <X size={11} />
      </button>
    </span>
  );
}

function SectionHeader({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div>
      <div className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
        <span className="inline-block w-1 h-4 rounded-full" style={{ backgroundColor: accent }} />
        {title}
      </div>
      <div className="text-xs text-[var(--text-muted)] mt-0.5 ml-3">{subtitle}</div>
    </div>
  );
}

function NoResultEmpty() {
  return (
    <div className="text-center py-10 px-6 rounded-xl border border-dashed border-[var(--border)]">
      <div className="text-4xl mb-2">🔍</div>
      <div className="font-semibold text-[var(--foreground)] mb-1">Aucun bureau trouvé</div>
      <div className="text-xs text-[var(--text-muted)]">
        Essayez un autre code postal, votre adresse, ou un nom de bureau (ex : <em>CPAS Liège</em>,{" "}
        <em>FGTB Mons</em>).
      </div>
    </div>
  );
}

function HeroInitial({
  accent,
  onWizard,
  onExpandSearch,
}: {
  accent: string;
  onWizard: () => void;
  onExpandSearch: () => void;
}) {
  return (
    <div
      className="text-center py-10 px-6 rounded-2xl border-[1.5px]"
      style={{
        background: `linear-gradient(180deg, ${accent}08 0%, transparent 100%)`,
        borderColor: `${accent}30`,
      }}
    >
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
        style={{ background: `${accent}18`, color: accent }}
      >
        <Sparkles size={28} />
      </div>
      <h3 className="font-extrabold text-lg text-[var(--foreground)] mb-1">
        Trouvez vos bureaux administratifs
      </h3>
      <p className="text-sm text-[var(--text-muted)] mb-5 max-w-md mx-auto">
        On vous pose 2 ou 3 petites questions, on vous indique exactement où aller.
      </p>
      <button
        type="button"
        onClick={onWizard}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:scale-[1.02] transition-transform"
        style={{ backgroundColor: accent }}
      >
        <Sparkles size={14} /> Aide-moi à trouver mon bureau
      </button>
      <div className="mt-5">
        <button
          type="button"
          onClick={onExpandSearch}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] underline-offset-2 hover:underline inline-flex items-center gap-1"
        >
          <Search size={11} />
          Ou je préfère chercher directement (adresse, CP, nom de bureau…)
        </button>
      </div>
    </div>
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
