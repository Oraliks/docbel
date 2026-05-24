"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ReviewBannerProps {
  slug: string;
  /** ISO string ou null si jamais revu. */
  lastReviewedAt: string | null;
  /** ISO string ou null si jamais revu. */
  nextReviewDue: string | null;
  /** Si true, on cache le bouton "Marquer comme revu" (pour la vue liste). */
  compact?: boolean;
}

type Status = "overdue" | "due_soon" | "ok" | "never_reviewed";

function computeStatus(nextReviewDue: string | null): Status {
  if (!nextReviewDue) return "never_reviewed";
  const due = new Date(nextReviewDue).getTime();
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  if (due < now) return "overdue";
  if (due - now < THIRTY_DAYS) return "due_soon";
  return "ok";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Bandeau d'alerte annuelle pour la fiabilité d'un calculateur.
 *
 * Couleurs/messages :
 *   - never_reviewed → bandeau bleu "jamais revu", bouton "Marquer comme revu"
 *   - overdue        → bandeau rouge "vérification due"
 *   - due_soon       → bandeau jaune "bientôt due"
 *   - ok             → bandeau vert discret "à jour"
 *
 * Le bouton POST /api/admin/calculators/[slug]/review puis recharge la page
 * via `router.refresh()` côté next.
 */
export function ReviewBanner({
  slug,
  lastReviewedAt,
  nextReviewDue,
  compact = false,
}: ReviewBannerProps) {
  const status = computeStatus(nextReviewDue);
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<{
    lastReviewedAt: string;
    nextReviewDue: string;
  } | null>(null);

  const currentStatus = optimistic
    ? computeStatus(optimistic.nextReviewDue)
    : status;
  const currentLastReviewedAt = optimistic
    ? optimistic.lastReviewedAt
    : lastReviewedAt;
  const currentNextReviewDue = optimistic
    ? optimistic.nextReviewDue
    : nextReviewDue;

  async function markAsReviewed() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/calculators/${slug}/review`, {
          method: "POST",
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const json = await res.json();
        setOptimistic({
          lastReviewedAt: json.tool.lastReviewedAt,
          nextReviewDue: json.tool.nextReviewDue,
        });
        toast.success("Calculateur marqué comme revu", {
          description: `Prochaine vérification : ${fmtDate(json.tool.nextReviewDue)}`,
        });
      } catch (e) {
        toast.error("Échec de la mise à jour", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  }

  const config = {
    overdue: {
      bg: "bg-red-50 dark:bg-red-950/20",
      border: "border-red-300 dark:border-red-700",
      text: "text-red-900 dark:text-red-200",
      icon: AlertTriangle,
      title: "Vérification annuelle DUE",
      message: `La dernière révision date du ${fmtDate(currentLastReviewedAt)}. Re-vérifie les barèmes officiels (SPF, ONSS, Securex) puis clique sur le bouton.`,
    },
    due_soon: {
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-300 dark:border-amber-600",
      text: "text-amber-900 dark:text-amber-200",
      icon: Clock,
      title: "Vérification annuelle bientôt due",
      message: `Prochaine révision prévue le ${fmtDate(currentNextReviewDue)}. Anticipe la vérification des barèmes.`,
    },
    never_reviewed: {
      bg: "bg-sky-50 dark:bg-sky-950/20",
      border: "border-sky-300 dark:border-sky-700",
      text: "text-sky-900 dark:text-sky-200",
      icon: Clock,
      title: "Jamais revu",
      message:
        "Aucune révision enregistrée. Vérifie les chiffres puis enregistre la date.",
    },
    ok: {
      bg: "bg-emerald-50/60 dark:bg-emerald-950/15",
      border: "border-emerald-300/70 dark:border-emerald-700/70",
      text: "text-emerald-900 dark:text-emerald-200",
      icon: CheckCircle2,
      title: "À jour",
      message: `Dernière révision le ${fmtDate(currentLastReviewedAt)}. Prochaine révision le ${fmtDate(currentNextReviewDue)}.`,
    },
  }[currentStatus];

  const Icon = config.icon;

  if (compact) {
    // Vue ligne (pour la table de la page liste) — pas de bouton, juste pastille.
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${config.bg} ${config.text}`}
        title={config.message}
      >
        <Icon className="size-3" />
        {currentStatus === "overdue"
          ? "à revoir"
          : currentStatus === "due_soon"
            ? "bientôt"
            : currentStatus === "never_reviewed"
              ? "jamais"
              : "à jour"}
      </span>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border ${config.border} ${config.bg} p-4 ${config.text}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <div className="text-[13px] font-bold">{config.title}</div>
          <p className="text-[12.5px] leading-relaxed">{config.message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={markAsReviewed}
        disabled={pending}
        className="inline-flex items-center gap-1.5 self-start rounded-lg border border-current/30 bg-background/40 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-background/70 disabled:opacity-50"
      >
        {pending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            En cours…
          </>
        ) : (
          <>
            <CheckCircle2 className="size-3.5" />
            Marquer comme revu
          </>
        )}
      </button>
    </div>
  );
}
