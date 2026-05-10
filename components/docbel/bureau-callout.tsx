"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ResolveResult } from "@/lib/bureaus/resolve";
import type { SerializedBureau, BureauTypeCode } from "@/lib/bureaus/types";
import { BureauCard } from "./bureau-card";

type Props = {
  /**
   * Code organisme du document terminé (organisme.code).
   *   - "cpas"  → CPAS attitré
   *   - "commune" → Maison communale attitrée
   *   - "onem"  → ONEM compétent
   *   - "capac" / "csc" / "fgtb" / "cgslb" → syndicat le plus proche du bon code
   */
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
  cgslb: "SYNDICAT",
};

export function BureauCallout({
  organismeCode,
  accent = "#C8102E",
  postalCode,
}: Props) {
  const [cp, setCp] = useState(postalCode ?? "");
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
    fetch(`/api/bureaus/resolve?cp=${encodeURIComponent(cp)}`)
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
  }, [cp, organismeCode]);

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
        data.proximite.syndicats.find(
          (s) => s.organismeCode?.toLowerCase() === organismeCode.toLowerCase()
        ) ?? data.proximite.syndicats[0] ?? null;
    }
  }

  if (!cp) {
    return (
      <Shell accent={accent} title="Où apporter ce document ?">
        <div className="text-sm text-[var(--text-muted)]">
          Entrez votre code postal pour voir où déposer ce document.
        </div>
        <input
          value={cp}
          onChange={(e) => setCp(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="Code postal (4 chiffres)"
          className="mt-2 w-[200px] px-3 py-1.5 rounded-lg border-[1.5px] bg-[var(--input)] text-sm"
          style={{ borderColor: accent }}
          inputMode="numeric"
        />
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell accent={accent} title="Où apporter ce document ?">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 size={14} className="animate-spin" /> Recherche du bureau attitré...
        </div>
      </Shell>
    );
  }

  if (!bureau) {
    return (
      <Shell accent={accent} title="Où apporter ce document ?">
        <div className="text-sm text-[var(--text-muted)]">
          Aucun bureau référencé pour le code postal {cp}.{" "}
          <button
            onClick={() => setCp("")}
            className="underline"
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
    <Shell accent={accent} title="Où apporter ce document ?">
      <BureauCard bureau={bureau} accent={accent} attitre compact enableReport={false} />
      <div className="text-[11px] text-[var(--text-faint)] mt-2">
        Code postal : {cp} ·{" "}
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

function Shell({
  accent,
  title,
  children,
}: {
  accent: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mt-4 p-4 rounded-xl bg-[var(--surface-2)] border-[1.5px] border-l-4"
      style={{ borderColor: `${accent}40`, borderLeftColor: accent }}
    >
      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-2"
        style={{ color: accent }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
