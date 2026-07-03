"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowRight, MapPin } from "lucide-react";
import type { ResolveResult } from "@/lib/bureaus/resolve";
import type { SerializedBureau, BureauTypeCode } from "@/lib/bureaus/types";
import { BureauCard } from "./bureau-card";

type Props = {
  organismeCode?: string | null;
  accent?: string;
  postalCode?: string;
};

const TYPE_BY_CODE: Record<string, BureauTypeCode> = {
  cpas: "CPAS",
  commune: "COMMUNE",
  onem: "ONEM",
  capac: "SYNDICAT",
  csc: "SYNDICAT",
  fgtb: "SYNDICAT",
  synova: "SYNDICAT",
};

export function BureauCallout({
  organismeCode,
  accent = "#C8102E",
  postalCode,
}: Props) {
  const [cp, setCp] = useState(postalCode ?? "");
  const [orgPref, setOrgPref] = useState<string | null>(null);
  const [data, setData] = useState<ResolveResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (postalCode) {
      setCp(postalCode);
      return;
    }
    let cancelled = false;
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const pc = j?.postalCode;
        if (typeof pc === "string" && /^\d{4}$/.test(pc)) setCp(pc);
        if (typeof j?.organismePaiement === "string") setOrgPref(j.organismePaiement);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [postalCode]);

  useEffect(() => {
    if (!cp || !/^\d{4}$/.test(cp) || !organismeCode) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ cp });
    // Si on demande "organisme de paiement", utiliser la préf user si elle existe
    if (orgPref && organismeCode === "capac") params.set("org", orgPref);
    fetch(`/api/bureaux/resolve?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ResolveResult | null) => {
        if (cancelled) return;
        setData(j);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cp, organismeCode, orgPref]);

  if (!organismeCode) return null;
  const targetType = TYPE_BY_CODE[organismeCode.toLowerCase()];
  if (!targetType) return null;

  let bureau: SerializedBureau | null = null;
  if (data) {
    if (targetType === "CPAS") bureau = data.attitre.cpas;
    else if (targetType === "COMMUNE") bureau = data.attitre.commune;
    else if (targetType === "ONEM") bureau = data.attitre.onem;
    else if (targetType === "SYNDICAT") {
      bureau =
        data.attitre.organismePaiement ??
        data.proximite.syndicats.find(
          (s) => s.organismeCode?.toLowerCase() === organismeCode.toLowerCase()
        ) ??
        data.proximite.syndicats[0] ??
        null;
    }
  }

  if (!cp) {
    return (
      <Shell accent={accent}>
        <div className="text-sm text-[var(--text-muted)] mb-3">
          Pour vous indiquer où apporter ce document, indiquez votre code postal :
        </div>
        <input
          value={cp}
          onChange={(e) => setCp(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="Code postal"
          className="w-[200px] px-3 py-2 rounded-lg border-[1.5px] bg-[var(--input)] text-sm font-semibold"
          style={{ borderColor: accent }}
          inputMode="numeric"
        />
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell accent={accent}>
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-2">
          <Loader2 size={14} className="animate-spin" /> Recherche du bureau attitré...
        </div>
      </Shell>
    );
  }

  if (!bureau) {
    return (
      <Shell accent={accent}>
        <div className="text-sm text-[var(--text-muted)] py-2">
          Aucun bureau référencé pour le code postal {cp}.{" "}
          <button
            onClick={() => setCp("")}
            className="underline font-semibold"
            style={{ color: accent }}
            type="button"
          >
            Modifier
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell accent={accent}>
      <BureauCard bureau={bureau} accent={accent} variant="attitre" enableReport={false} />
      <div className="text-[11px] text-[var(--text-faint)] mt-2 flex items-center gap-1.5">
        <MapPin size={11} /> Code postal : <strong>{cp}</strong> ·{" "}
        <button
          onClick={() => setCp("")}
          className="underline"
          style={{ color: accent }}
          type="button"
        >
          modifier
        </button>
      </div>
    </Shell>
  );
}

function Shell({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4 mb-4 transition-all"
      style={{
        background: `linear-gradient(to right, ${accent}10, ${accent}05)`,
        border: `1.5px solid ${accent}30`,
      }}
    >
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider mb-2.5 flex items-center gap-1.5"
        style={{ color: accent }}
      >
        <ArrowRight size={12} />
        Étape suivante — où apporter ce document
      </div>
      {children}
    </div>
  );
}
