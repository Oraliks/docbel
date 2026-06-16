import Link from "next/link";
import { LockIcon, ArrowLeftIcon } from "lucide-react";

/** Page propre affichée quand une formation privée/interne n'est pas accessible
 * au viewer (le contrôle est fait côté serveur — le slug seul ne suffit pas). */
export function PrivateNotice({ visibility }: { visibility: string }) {
  const internal = visibility === "internal";
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/formations"
        className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
      >
        <ArrowLeftIcon className="size-3.5" />
        Toutes les formations
      </Link>
      <section className="glass-surface flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="glass-icon-tile flex size-14 items-center justify-center rounded-2xl bg-[color:var(--glass-surface-strong)] text-[color:var(--glass-accent-deep)]">
          <LockIcon className="size-7" />
        </span>
        <h1 className="glass-display text-[24px] font-semibold">
          {internal ? "Formation interne" : "Formation privée"}
        </h1>
        <p className="max-w-md text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          Cette formation est {internal ? "réservée aux membres d'une organisation" : "privée"}.
          Si vous pensez devoir y accéder, contactez l&apos;organisateur ou Docbel.
        </p>
        <Link
          href="/formations"
          className="glass-cta mt-1 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold"
        >
          Voir les formations publiques
        </Link>
      </section>
    </div>
  );
}
