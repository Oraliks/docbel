import { PdfPresetsManager } from "@/components/admin/pdf-forms/presets-manager";

export const dynamic = "force-dynamic";

export default function PdfPresetsPage() {
  return (
    <div className="p-6">
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
