"use client";

// Panneau « Et maintenant ? » de l'écran de sortie du dossier (contenu de
// l'étape « Envoyez le tout à votre organisme de paiement » du BundleRoadmap).
// Récupère les bureaux OP compétents (route feuille-de-route), laisse le
// citoyen choisir son organisme de paiement en LOCAL (jamais stocké — spec,
// art. 9), et rend les blocs du moteur pur. Le contenu réglementaire
// (consignes du registre) vient du modèle FR, comme les seeds ; seul le
// chrome est i18n. La phrase de prudence n'est PAS répétée ici : l'écran
// porte déjà `roadmapDisclaimer` en pied de section (la page de garde PDF,
// elle, garde la sienne).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { buildFeuilleDeRoute } from "@/lib/feuille-de-route/build";
import {
  EXPLICATION_OP,
  OP_CODES,
  OP_LABELS,
  type BureauFeuille,
  type FeuilleServerData,
  type OpCode,
} from "@/lib/feuille-de-route/model";
import type { RoadmapDocument } from "./bundle-roadmap";
import { cn } from "@/lib/utils";

interface FeuilleDeRoutePanelProps {
  documents: RoadmapDocument[];
  bundleRunId: string;
  op: OpCode | null;
  onOpChange: (op: OpCode | null) => void;
}

function BureauCard({ bureau, titre }: { bureau: BureauFeuille; titre?: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3 text-sm">
      {titre ? (
        <p className="font-semibold text-[color:var(--glass-ink)]">{titre}</p>
      ) : null}
      <p className="font-medium text-[color:var(--glass-ink)]">{bureau.nom}</p>
      <p className="text-[color:var(--glass-ink-soft)]">{bureau.adresse}</p>
      {bureau.telephone ? (
        <p className="text-[color:var(--glass-ink-soft)]">{bureau.telephone}</p>
      ) : null}
      {bureau.siteWeb ? (
        <a
          href={bureau.siteWeb}
          target="_blank"
          rel="noreferrer"
          className="break-all text-[color:var(--glass-ink)] underline underline-offset-2"
        >
          {bureau.siteWeb}
        </a>
      ) : null}
    </div>
  );
}

export function FeuilleDeRoutePanel({
  documents,
  bundleRunId,
  op,
  onOpChange,
}: FeuilleDeRoutePanelProps) {
  const t = useTranslations("public.dossier");
  const [serverData, setServerData] = useState<FeuilleServerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unknownOpen, setUnknownOpen] = useState(false);
  const viewedSent = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bundles/runs/${bundleRunId}/feuille-de-route`);
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { serverData: FeuilleServerData | null };
          setServerData(data.serverData);
        }
      } catch {
        // Repli générique silencieux : la feuille reste utile sans adresse.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bundleRunId]);

  useEffect(() => {
    if (viewedSent.current) return;
    viewedSent.current = true;
    // Fréquentation du panneau — JAMAIS le choix d'OP (spec RGPD).
    void fetch("/api/bundles/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "feuille_de_route_viewed" }),
    }).catch(() => {});
  }, []);

  const feuille = buildFeuilleDeRoute({
    pieces: documents.map((d) => ({ slug: d.slug, titre: d.title })),
    serverData,
    opChoice: op,
  });

  return (
    <div className="mt-2 flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-[color:var(--glass-ink)]">
          {t("feuilleOpQuestion")}
        </p>
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-label={t("feuilleOpQuestion")}
        >
          {OP_CODES.map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={op === code}
              onClick={() => {
                setUnknownOpen(false);
                onOpChange(op === code ? null : code);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                op === code
                  ? "border-transparent bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                  : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink)] hover:bg-[color:var(--glass-surface-strong)]",
              )}
            >
              {OP_LABELS[code]}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={unknownOpen}
            onClick={() => {
              onOpChange(null);
              setUnknownOpen(true);
            }}
            className="rounded-full border border-dashed border-[color:var(--glass-border)] px-3 py-1.5 text-sm text-[color:var(--glass-ink-soft)] hover:bg-[color:var(--glass-surface)]"
          >
            {t("feuilleOpUnknown")}
          </button>
        </div>
        {unknownOpen ? (
          <p className="mt-2 text-sm text-[color:var(--glass-ink-soft)]">{EXPLICATION_OP}</p>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-[color:var(--glass-ink-soft)]">{t("feuilleLoading")}</p>
      ) : feuille.depot.mode === "bureau" ? (
        <BureauCard bureau={feuille.depot.bureau} />
      ) : feuille.depot.mode === "choix" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {feuille.depot.bureaux.map((b) => (
            <BureauCard key={b.opCode} bureau={b} titre={OP_LABELS[b.opCode]} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[color:var(--glass-ink-soft)]">{t("feuilleGeneric")}</p>
          <Link
            href="/bureaux"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[color:var(--glass-ink)] underline underline-offset-2"
          >
            <MapPin className="size-4" aria-hidden />
            {t("feuilleFindOffice")}
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {feuille.consignes.map((c) => (
          <li key={c.slug} className="text-sm text-[color:var(--glass-ink)]">
            <span className="font-medium">{c.titre}</span>{" "}
            <span className="text-[color:var(--glass-ink-soft)]">
              — {c.signatures}{" "}
              {c.exemplaires > 1 ? `(${c.exemplaires} exemplaires)` : "(1 exemplaire)"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
