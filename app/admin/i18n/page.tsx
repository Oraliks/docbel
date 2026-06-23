import { requireAdminAuth } from "@/lib/auth-check";
import { redirect } from "next/navigation";
import { ContentTranslationsManager } from "./content-translations-manager";

export const dynamic = "force-dynamic";

/// Édition des traductions de contenu DB (NL/EN) en regard de la source FR.
/// Chrome admin volontairement en FR codé en dur (pas d'i18n sur l'admin).
export default async function I18nAdminPage() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) redirect("/login");

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Traductions du contenu
        </h1>
        <p className="text-muted-foreground mt-2">
          Relisez et publiez les traductions NL / EN du contenu (le français
          est la source). Statuts&nbsp;: <strong>IA</strong> (1er jet
          automatique) → <strong>Relu</strong> → <strong>Publié</strong>.
        </p>
      </div>
      <ContentTranslationsManager />
    </div>
  );
}
