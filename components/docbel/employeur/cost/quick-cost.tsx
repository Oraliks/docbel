"use client";

/**
 * Mini-simulateur de coût employeur « simulation rapide » pour le tableau de bord.
 * Interactif : recalcule en direct via le moteur pur `estimateEmployerCost`.
 * 2 colonnes (champs / camembert), donut SVG réduit + animé discrètement
 * (transition sur les arcs). Le détail complet reste sur /employeur/simulateur-cout.
 */
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { estimateEmployerCost } from "@/lib/employeur/cost/engine";
import { WORKER_TYPES } from "@/lib/employeur/constants";
import { cn } from "@/lib/utils";

const eur = (n: number) =>
  `${n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const ARC = "transition-[stroke-dasharray,stroke-dashoffset] duration-500 ease-out";

export function QuickCost({
  title,
  isExample,
  initialGross,
  initialRegime,
  initialWorkerType,
}: {
  title: string;
  isExample: boolean;
  initialGross: number;
  initialRegime: "temps_plein" | "temps_partiel";
  initialWorkerType: string;
}) {
  const t = useTranslations("public.pro");
  const [gross, setGross] = useState(initialGross);
  const [regime, setRegime] = useState<"temps_plein" | "temps_partiel">(initialRegime);
  const [workerType, setWorkerType] = useState(initialWorkerType);

  const res = useMemo(
    () =>
      estimateEmployerCost({
        grossMonthlySalary: gross > 0 ? gross : 0,
        regime,
        workerType,
        contractType: "cdi",
        jointCommitteeNumber: "200",
      }),
    [gross, regime, workerType],
  );

  const brut = gross > 0 ? gross : 0;
  const cotis = res.estimatedEmployerContributions;
  const total = res.estimatedMonthlyEmployerCost;
  const autres = Math.max(0, Math.round((total - brut - cotis) * 100) / 100);
  const pct = (x: number) => (total > 0 ? (x / total) * 100 : 0);
  const pBrut = pct(brut);
  const pCotis = pct(cotis);
  const pAutres = pct(autres);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-sm font-semibold">{t("dashCostTitle")}</h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            isExample ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
          )}
        >
          {t(isExample ? "dashCostQuickSim" : "dashCostLastSim")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 pt-3">
        {/* Colonne 1 — champs */}
        <div className="space-y-2.5">
          <label className="block">
            <span className="text-[10px] text-muted-foreground">{t("dashCostGrossLabel")}</span>
            <div className="mt-1 flex items-center rounded-lg border border-border bg-background px-2 focus-within:border-primary/40">
              <input
                type="number"
                min={0}
                step={50}
                value={gross || ""}
                onChange={(e) => setGross(Number(e.target.value))}
                className="w-full bg-transparent py-1.5 text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-xs text-muted-foreground">€</span>
            </div>
          </label>

          <div>
            <span className="text-[10px] text-muted-foreground">{t("dashCostRegime")}</span>
            <div className="mt-1 flex rounded-lg bg-muted p-0.5 text-[11px]">
              {(["temps_plein", "temps_partiel"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegime(r)}
                  className={cn(
                    "flex-1 rounded-md py-1 transition-colors",
                    regime === r ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {t(r === "temps_plein" ? "dashCostFullTime" : "dashCostPartTime")}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-[10px] text-muted-foreground">{t("dashCostType")}</span>
            <select
              value={workerType}
              onChange={(e) => setWorkerType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/40"
            >
              {WORKER_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Colonne 2 — camembert + légende */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative size-24 shrink-0">
            <svg viewBox="0 0 36 36" className="size-24 -rotate-90">
              <circle cx="18" cy="18" r="15.915" fill="none" className="stroke-muted" strokeWidth="3.4" />
              <circle
                cx="18" cy="18" r="15.915" fill="none" stroke="#3b82f6" strokeWidth="3.4" pathLength={100}
                strokeDasharray={`${pBrut} ${100 - pBrut}`} strokeDashoffset={0} className={ARC}
              />
              <circle
                cx="18" cy="18" r="15.915" fill="none" stroke="var(--primary)" strokeWidth="3.4" pathLength={100}
                strokeDasharray={`${pCotis} ${100 - pCotis}`} strokeDashoffset={-pBrut} className={ARC}
              />
              <circle
                cx="18" cy="18" r="15.915" fill="none" stroke="#ec4899" strokeWidth="3.4" pathLength={100}
                strokeDasharray={`${pAutres} ${100 - pAutres}`} strokeDashoffset={-(pBrut + pCotis)} className={ARC}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] text-muted-foreground">{t("dashCostTotal")}</span>
              <span className="text-[11px] font-bold leading-tight">{eur(total)}</span>
              <span className="text-[8px] text-muted-foreground">{t("dashCostPerMonth")}</span>
            </div>
          </div>
          <ul className="w-full space-y-0.5 text-[10px]">
            <Legend color="#3b82f6" label={t("dashCostGross")} value={eur(brut)} />
            <Legend color="var(--primary)" label={t("dashCostContributions")} value={eur(cotis)} />
            <Legend color="#ec4899" label={t("dashCostOthers")} value={eur(autres)} />
          </ul>
        </div>
      </div>

      <div className="mt-auto px-5 pb-5">
        <p className="mb-2 rounded-lg bg-muted/40 px-3 py-2 text-[10px] leading-snug text-muted-foreground">
          {t("dashCostNote")}
        </p>
        <Link
          href="/employeur/simulateur-cout"
          className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary/10 py-2 text-xs font-medium text-primary no-underline"
        >
          {t("dashCostDetailSave")} <ArrowRight className="size-3.5" />
        </Link>
        <p className="mt-1 truncate text-center text-[10px] text-muted-foreground">{title}</p>
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="flex-1 truncate text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}
