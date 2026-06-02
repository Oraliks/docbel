import { BureauxAdminWorkspace } from "@/components/admin/bureaux-admin-workspace";

export const dynamic = "force-dynamic";

export default function BureauxAdminPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Bureaux &amp; antennes</h1>
        <p className="text-muted-foreground mt-2">
          Annuaire des CPAS, communes, ONEM, syndicats, mutuelles et permanences. Sert le
          résolveur public et les liens contextuels en fin de génération de document.
        </p>
      </div>
      <BureauxAdminWorkspace />
    </div>
  );
}
