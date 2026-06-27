import { GlossaryManager } from "@/components/admin/i18n/glossary-manager";

export const dynamic = "force-dynamic";

/// Glossaire terminologique belge (table GlossaryTerm) — injecté dans le prompt
/// de traduction IA. L'auth admin est appliquée par app/admin/layout.tsx.
export default function GlossaryPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Glossaire de traduction
        </h1>
        <p className="mt-2 text-muted-foreground">
          Terminologie belge injectée dans le prompt de l&apos;IA pour garantir
          la cohérence des traductions (RVA, OCMW, INSZ…). Toute modification est
          prise en compte immédiatement par le moteur de traduction. Stratégies&nbsp;:{" "}
          <strong>🟢 Traduire</strong> · <strong>🟡 Traduire + glose</strong> ·{" "}
          <strong>🔴 Garder le terme + glose</strong>.
        </p>
      </div>
      <GlossaryManager />
    </div>
  );
}
