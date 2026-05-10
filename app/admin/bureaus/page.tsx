import { BureausManager } from "@/components/admin/bureaus-manager";

export const dynamic = "force-dynamic";

export default function BureausAdminPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Bureaux & antennes</h1>
        <p className="text-muted-foreground mt-2">
          Annuaire des CPAS, communes, bureaux ONEM, syndicats et permanences. Sert
          le résolveur public &laquo;&nbsp;Trouver un bureau près de chez vous&nbsp;&raquo;
          ainsi que les liens contextuels en fin de génération de document.
        </p>
      </div>
      <BureausManager />
    </div>
  );
}
