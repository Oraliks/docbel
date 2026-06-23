import { TranslationSuggestionsManager } from "@/components/admin/i18n/translation-suggestions-manager";

export const dynamic = "force-dynamic";

// Chrome FR (admin shadcn). L'auth admin est déjà appliquée par
// app/admin/layout.tsx (role=admin actif → sinon notFound).
export default function TranslationSuggestionsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Corrections de traduction
        </h1>
        <p className="mt-2 text-muted-foreground">
          Suggestions soumises par la communauté. Accepter applique la
          correction au contenu (traduction relue) ; les corrections d&apos;UI
          (clé i18n) sont à reporter manuellement dans les fichiers JSON.
        </p>
      </div>
      <TranslationSuggestionsManager />
    </div>
  );
}
