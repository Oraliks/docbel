import Link from "next/link";
import { ArrowLeftIcon, LockIcon } from "lucide-react";

/**
 * Affiché quand un visiteur n'a pas le droit d'utiliser un outil réservé à un
 * segment (employeur / partenaire). Informatif et non-bloquant dans l'esprit :
 * on explique pourquoi et on propose la connexion, plutôt qu'un 404 brut.
 *
 * NB : les outils "citoyen" sont publics → on n'arrive jamais ici pour eux.
 */
export function RestrictedToolView({
  toolName,
  segments,
}: {
  toolName: string;
  segments: string[];
}) {
  const hasPartner = segments.includes("partenaire");
  const hasEmployer = segments.includes("employeur");
  const audienceLabel =
    hasPartner && hasEmployer
      ? "aux partenaires et aux employeurs"
      : hasPartner
        ? "aux partenaires"
        : hasEmployer
          ? "aux employeurs"
          : "aux comptes autorisés";

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)]">
        <LockIcon className="size-6" />
      </span>
      <h1 className="glass-display text-[28px] font-semibold leading-tight">
        Outil réservé
      </h1>
      <p className="max-w-md text-[14px] text-[color:var(--glass-ink-soft)]">
        <strong>{toolName}</strong> est réservé {audienceLabel}. Connectez-vous
        avec un compte autorisé pour y accéder, ou contactez DocBel si votre
        organisation devrait y avoir droit.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className="rounded-full px-5 py-3 text-[13px] font-bold"
          style={{
            background: "var(--glass-ink)",
            color: "var(--glass-bg-a)",
          }}
        >
          Se connecter
        </Link>
        <Link
          href="/outils"
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-5 py-3 text-[13px] font-semibold text-[color:var(--glass-ink-soft)]"
        >
          <ArrowLeftIcon className="size-4" />
          Retour aux outils
        </Link>
      </div>
    </div>
  );
}
