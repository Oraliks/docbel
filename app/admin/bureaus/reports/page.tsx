import { ReportsManager } from "@/components/admin/bureaus/reports-manager";

export const dynamic = "force-dynamic";

export default function ReportsAdminPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Signalements bureaux</h1>
        <p className="text-muted-foreground mt-2">
          Erreurs signalées par les utilisateurs publics (horaires, adresse, téléphone…). À
          traiter pour maintenir la qualité de la base.
        </p>
      </div>
      <ReportsManager />
    </div>
  );
}
