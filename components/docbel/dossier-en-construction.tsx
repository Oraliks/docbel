/// Page affichée quand un dossier EXISTE en base mais est inactif (stub « à
/// créer », active=false) — au lieu d'un 404 sec. Complète les dossiers stub
/// du Decision Builder : l'utilisateur a été orienté ici, on lui explique que
/// le parcours arrive bientôt + on l'oriente vers un contact.

import Link from "next/link";
import { ArrowLeft, Construction, ExternalLink, MessageCircle } from "lucide-react";
import type { OfficialSource } from "@/lib/bundles/types";

export function DossierEnConstruction({
  name,
  description,
  organism,
  officialSources,
}: {
  name: string;
  description: string | null;
  organism: string | null;
  officialSources: OfficialSource[];
}) {
  return (
    <section className="relative isolate mx-auto flex max-w-2xl flex-col gap-5 py-10">
      <Link
        href="/mon-dossier"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-[color:var(--glass-ink-faint)] transition hover:text-[color:var(--glass-ink)]"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Retour à mon dossier
      </Link>

      <div className="glass-surface flex flex-col gap-4 p-6">
        <span
          className="flex size-11 items-center justify-center rounded-xl"
          style={{
            background:
              "color-mix(in oklab, var(--glass-accent-d) 22%, var(--glass-surface-strong))",
            color: "var(--glass-pop-fg)",
          }}
          aria-hidden
        >
          <Construction className="size-5" />
        </span>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
            Bientôt disponible
          </p>
          <h1 className="glass-display text-[26px] font-semibold leading-tight">
            {name}
          </h1>
          {organism ? (
            <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
              {organism}
            </p>
          ) : null}
        </div>

        <p className="text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          {description ||
            "Ce dossier est en cours de préparation sur Beldoc. Le parcours guidé sera bientôt accessible."}{" "}
          En attendant, votre organisme de paiement ou l&apos;ONEM peut vous
          renseigner.
        </p>

        {officialSources.length > 0 && (
          <div className="space-y-1 border-t border-[color:var(--glass-ink-line)] pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--glass-ink-faint)]">
              Sources officielles
            </p>
            <ul className="space-y-0.5">
              {officialSources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-xs text-[color:var(--glass-accent-deep)] underline-offset-2 hover:underline"
                  >
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
          <Link
            href="/contact"
            className="glass-cta inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-bold"
          >
            <MessageCircle className="size-4" aria-hidden />
            Nous contacter
          </Link>
          <Link
            href="/mon-dossier"
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[color:var(--glass-border)] px-4 py-2.5 text-[13px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
          >
            Voir d&apos;autres dossiers
          </Link>
        </div>
      </div>
    </section>
  );
}
