import Link from "next/link";
import { FileWarningIcon, ArrowLeft } from "lucide-react";

interface Props {
  formTitle: string;
  /// Message custom saisi par l'admin. Si vide, message générique.
  customMessage?: string | null;
}

/// Affichée quand un PdfForm publié est temporairement mis en pause
/// (`active=false`). Préférable au 404 brut : l'utilisateur comprend que
/// c'est volontaire et qu'il pourra revenir.
export function DisabledFormView({ formTitle, customMessage }: Props) {
  const message =
    customMessage?.trim() ||
    "Notre équipe l'a mis en pause volontairement, soit pour corriger une erreur, soit pour intégrer une mise à jour du document officiel. Il sera remis en ligne dès que possible.";

  return (
    <section className="flex flex-col gap-6">
      <div className="glass-surface relative flex flex-col items-center gap-5 px-8 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-300">
          <FileWarningIcon className="size-7" />
        </span>

        <div className="max-w-xl space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
            Formulaire temporairement indisponible
          </p>
          <h1 className="glass-display text-[32px] font-semibold leading-[1.1] sm:text-[40px]">
            {formTitle}{" "}
            <em className="text-[color:var(--glass-ink-soft)]">
              n&apos;est pas accessible pour le moment.
            </em>
          </h1>
          <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
            {message}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/outils"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2 text-[13px] font-semibold text-[color:var(--glass-ink)] transition hover:bg-white/55"
          >
            <ArrowLeft className="size-3.5" />
            Retour au catalogue
          </Link>
          <Link
            href="/aidez-moi"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-[color:var(--glass-bg-a)] transition"
            style={{ background: "var(--glass-ink)" }}
          >
            Besoin d&apos;aide pour ma démarche&nbsp;?
          </Link>
        </div>

        <p className="pt-4 text-[11px] text-[color:var(--glass-ink-faint)]">
          Tu pensais pouvoir finir ta démarche maintenant ?{" "}
          <Link href="/aidez-moi" className="underline">
            Signale-le
          </Link>
          , on regarde.
        </p>
      </div>
    </section>
  );
}
