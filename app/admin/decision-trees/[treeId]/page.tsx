/// Éditeur d'un arbre d'orientation (admin). Server loader minimal : passe juste
/// l'id au client lourd (l'auth admin est portée par app/admin/layout.tsx).

import { TreeEditorClient } from "./tree-editor-client";

export const dynamic = "force-dynamic";

export default async function DecisionTreeEditorPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  return <TreeEditorClient treeId={treeId} />;
}
