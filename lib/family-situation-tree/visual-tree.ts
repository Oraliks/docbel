export type VisualTreeNodeKind =
  | "root"
  | "question"
  | "subtree"
  | "detail"
  | "category-a"
  | "category-n"
  | "category-b"
  | "result"
  | "reference";

export type VisualTreeNode = {
  id: string;
  kind: VisualTreeNodeKind;
  titleKey: string;
  descriptionKey?: string;
  itemsKey?: string;
  x: number;
  y: number;
  width: number;
};

export type VisualTreeEdge = {
  id: string;
  from: string;
  to: string;
  labelKey?: string;
  dashed?: boolean;
};

/**
 * Description purement visuelle de la V0. Elle ne contient aucune règle de
 * décision ni donnée de situation personnelle : les clés sont résolues côté UI.
 */
export const FAMILY_SITUATION_VISUAL_TREE = {
  width: 2800,
  height: 1620,
  nodes: [
    { id: "root", kind: "root", titleKey: "rootTitle", descriptionKey: "rootDescription", x: 1120, y: 50, width: 330 },
    { id: "alone-question", kind: "question", titleKey: "aloneQuestion", x: 1135, y: 230, width: 300 },
    { id: "alone-subtree", kind: "subtree", titleKey: "aloneSubtreeTitle", descriptionKey: "subtreeToDetail", x: 140, y: 440, width: 380 },
    { id: "alone-detail", kind: "detail", titleKey: "aloneDetailTitle", itemsKey: "aloneDetailItems", x: 130, y: 620, width: 400 },
    { id: "alone-summary", kind: "question", titleKey: "aloneSummary", x: 180, y: 920, width: 300 },
    { id: "category-a-alone", kind: "category-a", titleKey: "categoryA", x: 50, y: 1110, width: 170 },
    { id: "category-n", kind: "category-n", titleKey: "categoryN", x: 320, y: 1110, width: 170 },
    { id: "partner-question", kind: "question", titleKey: "partnerQuestion", x: 1100, y: 440, width: 370 },
    { id: "partner-subtree", kind: "subtree", titleKey: "partnerSubtreeTitle", descriptionKey: "subtreeToDetail", x: 1040, y: 650, width: 490 },
    { id: "partner-detail", kind: "detail", titleKey: "partnerDetailTitle", itemsKey: "partnerDetailItems", x: 1040, y: 830, width: 490 },
    { id: "partner-summary", kind: "question", titleKey: "partnerSummary", x: 1135, y: 1145, width: 300 },
    { id: "category-b", kind: "category-b", titleKey: "categoryB", x: 1010, y: 1330, width: 170 },
    { id: "category-a-partner", kind: "category-a", titleKey: "categoryA", x: 1390, y: 1330, width: 170 },
    { id: "unrelated-question", kind: "question", titleKey: "unrelatedQuestion", x: 1730, y: 650, width: 390 },
    { id: "alone-reference", kind: "reference", titleKey: "aloneReferenceTitle", descriptionKey: "aloneReferenceDescription", x: 1710, y: 850, width: 430 },
    { id: "household", kind: "subtree", titleKey: "householdTitle", descriptionKey: "householdDescription", x: 2260, y: 850, width: 430 },
    { id: "children", kind: "detail", titleKey: "childrenTitle", itemsKey: "childrenItems", x: 1950, y: 1120, width: 340 },
    { id: "parents", kind: "detail", titleKey: "parentsTitle", itemsKey: "parentsItems", x: 2350, y: 1120, width: 340 },
    { id: "mixed", kind: "detail", titleKey: "mixedTitle", itemsKey: "mixedItems", x: 1950, y: 1370, width: 340 },
    { id: "other", kind: "detail", titleKey: "otherTitle", itemsKey: "otherItems", x: 2350, y: 1370, width: 340 },
  ] satisfies VisualTreeNode[],
  edges: [
    { id: "root-alone-question", from: "root", to: "alone-question" },
    { id: "alone-yes", from: "alone-question", to: "alone-subtree", labelKey: "yes" },
    { id: "alone-no", from: "alone-question", to: "partner-question", labelKey: "no" },
    { id: "alone-detail", from: "alone-subtree", to: "alone-detail" },
    { id: "alone-summary", from: "alone-detail", to: "alone-summary" },
    { id: "alone-a", from: "alone-summary", to: "category-a-alone", labelKey: "yes" },
    { id: "alone-n", from: "alone-summary", to: "category-n", labelKey: "no" },
    { id: "partner-yes", from: "partner-question", to: "partner-subtree", labelKey: "yes" },
    { id: "partner-no", from: "partner-question", to: "unrelated-question", labelKey: "no" },
    { id: "partner-detail", from: "partner-subtree", to: "partner-detail" },
    { id: "partner-summary", from: "partner-detail", to: "partner-summary" },
    { id: "partner-b", from: "partner-summary", to: "category-b", labelKey: "yes" },
    { id: "partner-a", from: "partner-summary", to: "category-a-partner", labelKey: "no" },
    { id: "unrelated-reference", from: "unrelated-question", to: "alone-reference", labelKey: "yesHypothesis", dashed: true },
    { id: "unrelated-household", from: "unrelated-question", to: "household", labelKey: "no" },
    { id: "household-children", from: "household", to: "children" },
    { id: "household-parents", from: "household", to: "parents" },
    { id: "household-mixed", from: "household", to: "mixed" },
    { id: "household-other", from: "household", to: "other" },
  ] satisfies VisualTreeEdge[],
} as const;
