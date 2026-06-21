/// Liste des arbres d'orientation (Decision Builder). L'auth admin est portée
/// par app/admin/layout.tsx.

import { DecisionTreesList } from "@/components/decision-builder/decision-trees-list";

export const dynamic = "force-dynamic";

export default function DecisionTreesPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Decision Builder</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Arbres d'orientation : composez les questions qui guident l'utilisateur
          vers le bon dossier. L'arbre oriente seulement — chaque dossier garde
          son propre formulaire.
        </p>
      </div>
      <DecisionTreesList />
    </div>
  );
}
