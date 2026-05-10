import { OnemAssignmentsManager } from "@/components/admin/bureaus/onem-assignments-manager";

export const dynamic = "force-dynamic";

export default function OnemAssignmentsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Compétences territoriales ONEM</h1>
        <p className="text-muted-foreground mt-2">
          Pour chaque bureau ONEM, sélectionnez les communes qu&apos;il dessert (compétence
          territoriale &laquo;&nbsp;chômage&nbsp;&raquo;). Cette matrice alimente le résolveur
          public &laquo;&nbsp;Trouver un bureau&nbsp;&raquo;.
        </p>
      </div>
      <OnemAssignmentsManager />
    </div>
  );
}
