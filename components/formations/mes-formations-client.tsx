"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AwardIcon,
  BookmarkIcon,
  CalendarRangeIcon,
  CompassIcon,
  DownloadIcon,
  GraduationCapIcon,
  MapPinIcon,
  SparklesIcon,
} from "lucide-react";
import type { TrainingCardData } from "@/lib/formations/queries";
import type { MyEnrollment, MyResult, MyCertificate } from "@/lib/formations/me-queries";
import { TrainingCard } from "@/components/formations/training-card";
import { resolveIcon } from "@/components/formations/icons";
import { formatDate } from "@/components/formations/format";
import {
  ENROLLMENT_STATUS_LABELS,
  type TrainingEnrollmentStatus,
} from "@/lib/formations/constants";
import { BRANCH_BY_KEY } from "@/lib/formations/boussole/branches";
import { useSavedFormations } from "@/hooks/useSavedFormations";

interface Props {
  isLoggedIn: boolean;
  enrollments: MyEnrollment[];
  results: MyResult[];
  certificates: MyCertificate[];
  serverSavedSlugs: string[];
}

export function MesFormationsClient({ isLoggedIn, enrollments, results, certificates, serverSavedSlugs }: Props) {
  const { saved } = useSavedFormations();
  const [cards, setCards] = useState<TrainingCardData[]>([]);

  // Fusionne les sauvegardes serveur (cross-device) dans le localStorage au montage.
  useEffect(() => {
    if (serverSavedSlugs.length === 0) return;
    try {
      const raw = localStorage.getItem("docbel:formations:saved");
      const local: string[] = raw ? JSON.parse(raw) : [];
      const union = Array.from(new Set([...local, ...serverSavedSlugs]));
      if (union.length !== local.length) {
        localStorage.setItem("docbel:formations:saved", JSON.stringify(union));
        window.dispatchEvent(new Event("docbel:formations:saved-change"));
      }
    } catch {
      /* ignore */
    }
  }, [serverSavedSlugs]);

  const savedKey = saved.join(",");
  useEffect(() => {
    if (saved.length === 0) { setCards([]); return; }
    let cancelled = false;
    fetch(`/api/formations/cards?slugs=${encodeURIComponent(saved.join(","))}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setCards(d.cards ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const hasAnything =
    enrollments.length > 0 || results.length > 0 || certificates.length > 0 || saved.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="glass-surface flex flex-col gap-2 p-7">
        <h1 className="glass-display text-[30px] font-semibold">Mes formations</h1>
        <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
          Vos inscriptions, vos formations sauvegardées et vos résultats d&apos;orientation.
        </p>
        {!isLoggedIn && (
          <p className="text-[12.5px] text-[color:var(--glass-ink-faint)]">
            <Link href="/login" className="font-semibold text-[color:var(--glass-accent-deep)] hover:underline">
              Connectez-vous
            </Link>{" "}
            pour retrouver vos inscriptions et vos résultats sur tous vos appareils.
          </p>
        )}
      </section>

      {!hasAnything && (
        <section className="glass-surface flex flex-col items-center gap-3 px-6 py-14 text-center">
          <GraduationCapIcon className="size-8 text-[color:var(--glass-ink-faint)]" />
          <p className="text-[14px] font-semibold">Vous n&apos;avez pas encore de formation.</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link href="/formations" className="glass-cta inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold">
              Explorer les formations
            </Link>
            <Link href="/formations/boussole" className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-5 py-2.5 text-[13px] font-bold text-[color:var(--glass-ink)]">
              <CompassIcon className="size-4" /> Lancer la Boussole
            </Link>
          </div>
        </section>
      )}

      {enrollments.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 px-1 text-[16px] font-bold tracking-tight">
            <CalendarRangeIcon className="size-4 text-[color:var(--glass-accent-deep)]" /> Mes inscriptions
          </h2>
          <div className="flex flex-col gap-2.5">
            {enrollments.map((e) => (
              <Link key={e.id} href={`/formations/${e.trainingSlug}`}
                className="glass-surface glass-interactive flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-[14px] font-bold">{e.trainingTitle}</p>
                  <p className="flex flex-wrap items-center gap-x-3 text-[12px] text-[color:var(--glass-ink-soft)]">
                    {e.orgName ? <span>{e.orgName}</span> : null}
                    {e.sessionStartsAt && (
                      <span className="inline-flex items-center gap-1"><CalendarRangeIcon className="size-3" />{formatDate(e.sessionStartsAt)}</span>
                    )}
                    {e.sessionCity && (
                      <span className="inline-flex items-center gap-1"><MapPinIcon className="size-3" />{e.sessionCity}</span>
                    )}
                  </p>
                </div>
                <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: "var(--glass-surface-strong)", color: "var(--glass-ink-soft)" }}>
                  {ENROLLMENT_STATUS_LABELS[e.status as TrainingEnrollmentStatus] ?? e.status}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 px-1 text-[16px] font-bold tracking-tight">
            <SparklesIcon className="size-4 text-[color:var(--glass-accent-deep)]" /> Mes résultats Boussole
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => {
              const branch = r.primaryBranchKey ? BRANCH_BY_KEY[r.primaryBranchKey as keyof typeof BRANCH_BY_KEY] : null;
              const Icon = resolveIcon(branch?.icon);
              return (
                <Link key={r.id} href={`/formations${r.primaryBranchKey ? `?branch=${r.primaryBranchKey}` : ""}`}
                  className="glass-surface glass-interactive flex items-center gap-3 p-4">
                  <span className="glass-icon-tile flex size-10 items-center justify-center rounded-xl"
                    style={{ background: `color-mix(in oklab, ${branch?.color ?? "#7C3AED"} 18%, transparent)`, color: branch?.color ?? "#7C3AED" }}>
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-[13px] font-bold">{branch?.name ?? "Résultat"}</p>
                    <p className="text-[11px] text-[color:var(--glass-ink-faint)]">{formatDate(r.createdAt)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {certificates.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 px-1 text-[16px] font-bold tracking-tight">
            <AwardIcon className="size-4 text-[color:var(--glass-accent-deep)]" /> Mes attestations
          </h2>
          <div className="flex flex-col gap-2.5">
            {certificates.map((c) => (
              <div
                key={c.id}
                className="glass-surface flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="text-[14px] font-bold">{c.trainingTitle}</p>
                  <p className="text-[12px] text-[color:var(--glass-ink-soft)]">
                    {c.orgName ? `${c.orgName} · ` : ""}N° {c.certificateNumber} · {formatDate(c.issuedAt)}
                  </p>
                </div>
                <a
                  href={`/api/formations/certificates/${c.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-cta inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-bold"
                >
                  <DownloadIcon className="size-4" />
                  Télécharger
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {saved.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 px-1 text-[16px] font-bold tracking-tight">
            <BookmarkIcon className="size-4 text-[color:var(--glass-accent-deep)]" /> Formations sauvegardées
          </h2>
          {cards.length === 0 ? (
            <p className="px-1 text-[13px] text-[color:var(--glass-ink-soft)]">Chargement…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => <TrainingCard key={c.id} training={c} />)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
