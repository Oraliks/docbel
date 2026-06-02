import { CommissionsManager } from "@/components/admin/commissions-manager";

export const dynamic = "force-dynamic";

export default function CommissionsAdminPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
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
