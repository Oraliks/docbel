import { PdfPresetsManager } from "@/components/admin/pdf-forms/presets-manager";

export const dynamic = "force-dynamic";

export default function PdfPresetsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Presets de champs</h1>
        <p className="text-muted-foreground mt-2">
          Modèles de validation réutilisables (NISS, IBAN, code postal…) applicables aux champs des formulaires.
        </p>
      </div>
      <PdfPresetsManager />
    </div>
  );
}
