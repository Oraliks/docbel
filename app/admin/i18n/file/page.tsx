import { TranslationJobsManager } from "@/components/admin/i18n/translation-jobs-manager";

export const dynamic = "force-dynamic";

/// File d'attente durable de l'auto-traduction du contenu DB (table
/// TranslationJob). L'auth admin est appliquée par app/admin/layout.tsx.
export default function TranslationJobsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">File de traduction</h1>
        <p className="mt-2 text-muted-foreground">
          À chaque sauvegarde d&apos;un contenu FR, des jobs de traduction (NL,
          EN) sont mis en file et traités en arrière-plan. Les jobs survivent en
          base&nbsp;: en cas d&apos;échec (crédit IA, réseau), relancez-les ici.
          Une traduction déjà <strong>relue</strong> ou{" "}
          <strong>publiée</strong> n&apos;est jamais réécrasée.
        </p>
      </div>
      <TranslationJobsManager />
    </div>
  );
}
