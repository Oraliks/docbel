import Link from "next/link";
import { Wrench } from "lucide-react";

/**
 * Écran de maintenance plein page (visiteurs non-admin quand le mode
 * maintenance est actif). Sans en-tête ni pied de page. La décision d'affichage
 * (mode actif + bypass admin) est prise en amont dans `AppLayoutClient`.
 */
export function MaintenanceScreen({
  siteName,
  message,
}: {
  siteName: string;
  message: string;
}) {
  return (
    <div className="glass-root">
      <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <Wrench className="size-7" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{siteName}</h1>
          <p className="text-base text-muted-foreground [overflow-wrap:anywhere]">
            {message}
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Espace administrateur
        </Link>
      </main>
    </div>
  );
}
