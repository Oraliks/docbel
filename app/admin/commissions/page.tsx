import { CommissionsManager } from "@/components/admin/commissions-manager";

export const dynamic = "force-dynamic";

export default function CommissionsAdminPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Commissions paritaires</h1>
        <p className="text-muted-foreground mt-2">
          Gérez la liste officielle des commissions paritaires et sous-commissions belges.
        </p>
      </div>
      <CommissionsManager />
    </div>
  );
}
