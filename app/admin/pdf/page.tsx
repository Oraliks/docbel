import { PdfFormsList } from "@/components/admin/pdf-forms/forms-list";

export const dynamic = "force-dynamic";

export default function PdfFormsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">PDF Forms</h1>
        <p className="text-muted-foreground mt-2">
          Génération de documents à partir de PDF officiels à champs (AcroForm).
          Le PDF rempli n&apos;est jamais stocké — téléchargement direct ou envoi Doccle.
        </p>
      </div>
      <PdfFormsList />
    </div>
  );
}
