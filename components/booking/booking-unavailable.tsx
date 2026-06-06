import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { GLASS_CARD, GLASS_PRIMARY_STYLE } from "@/lib/glass-classes";

// Page « bientôt disponible » (guichet inactif) ou « de retour bientôt » (erreur
// runtime). Composant neutre, utilisable côté serveur (page) et client (error.tsx).
export function BookingUnavailable({
  variant,
  tenantName,
  onRetry,
}: {
  variant: "soon" | "error";
  tenantName?: string | null;
  onRetry?: () => void;
}) {
  const isSoon = variant === "soon";
  const title = isSoon
    ? "Bientôt disponible"
    : "Service momentanément indisponible";
  const message = isSoon
    ? `${
        tenantName
          ? `La prise de rendez-vous de ${tenantName}`
          : "Ce service de prise de rendez-vous"
      } n'est pas encore ouverte. Revenez bientôt — merci de votre patience.`
    : "Une erreur est survenue. Le service de prise de rendez-vous est de retour très bientôt.";

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col py-16">
      <div
        className={`${GLASS_CARD} glass-surface flex flex-col items-center gap-4 rounded-2xl p-8 text-center`}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:var(--glass-border)] text-[color:var(--glass-accent-deep)]">
          <CalendarClock size={26} />
        </span>
        <h1 className="glass-display text-[26px] font-semibold leading-tight">
          {title}
        </h1>
        <p className="text-[14px] text-[color:var(--glass-ink-soft)]">{message}</p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-4">
          {onRetry && (
            <button
              onClick={onRetry}
              style={GLASS_PRIMARY_STYLE}
              className="rounded-full px-5 py-2 text-[14px] font-semibold transition-opacity hover:opacity-80"
            >
              Réessayer
            </button>
          )}
          <Link
            href="/"
            className="text-[13px] text-[color:var(--glass-ink-soft)] underline underline-offset-4 hover:text-[color:var(--glass-ink)]"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </section>
  );
}
