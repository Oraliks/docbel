"use client";

/// Wrapper client de l'éditeur (chargé en ssr:false comme page-editor-client /
/// pdf-form-editor — l'éditeur est lourd et 100% interactif).

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

function EditorLoading() {
  const t = useTranslations("admin.decisionTrees");
  return (
    <div className="flex-1 p-8 text-sm text-muted-foreground">
      {t("editorLoading")}
    </div>
  );
}

const TreeEditor = dynamic(
  () => import("@/components/decision-builder/tree-editor").then((m) => m.TreeEditor),
  {
    ssr: false,
    loading: () => <EditorLoading />,
  },
);

export function TreeEditorClient({ treeId }: { treeId: string }) {
  return <TreeEditor treeId={treeId} />;
}
