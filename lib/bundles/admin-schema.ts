import { z } from "zod";
import type {
  BundleCondition,
  BundleConditionRule,
  ConditionGroup,
  ConditionLeaf,
  ConditionNode,
  ConditionOp,
} from "./conditions";

const scalarSchema = z.union([z.string().max(500), z.number().finite(), z.boolean()]);
const conditionValueSchema = z.union([
  scalarSchema,
  z.array(scalarSchema).max(100),
]);

const CONDITION_OPS = [
  "equals",
  "notEquals",
  "in",
  "notIn",
  "contains",
  "truthy",
  "falsy",
  "gt",
  "lt",
  "gte",
  "lte",
  "isEmpty",
  "isNotEmpty",
] as const satisfies readonly ConditionOp[];

const VALUELESS_OPS = new Set<ConditionOp>([
  "truthy",
  "falsy",
  "isEmpty",
  "isNotEmpty",
]);

const conditionLeafFields = {
  sourceTemplateId: z.string().trim().min(1).max(191),
  fieldId: z.string().trim().min(1).max(191),
  op: z.enum(CONDITION_OPS),
  value: conditionValueSchema.optional(),
};

const legacyLeafSchema = z
  .object(conditionLeafFields)
  .strict()
  .superRefine(validateConditionValue);

const v2LeafSchema = z
  .object({ type: z.literal("leaf"), ...conditionLeafFields })
  .strict()
  .superRefine(validateConditionValue);

function validateConditionValue(
  leaf: { op: ConditionOp; value?: unknown },
  ctx: z.RefinementCtx,
): void {
  if (!VALUELESS_OPS.has(leaf.op) && leaf.value === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: `Une valeur est requise pour l'opérateur ${leaf.op}.`,
    });
  }
}

type RawConditionNode =
  | z.infer<typeof v2LeafSchema>
  | { type: "and" | "or"; rules: RawConditionNode[] };

const conditionNodeSchema: z.ZodType<RawConditionNode> = z.lazy(() =>
  z.union([
    v2LeafSchema,
    z
      .object({
        type: z.enum(["and", "or"]),
        rules: z.array(conditionNodeSchema).min(1).max(100),
      })
      .strict(),
  ]),
);

const rawConditionSchema = z.union([
  z.null(),
  z.array(legacyLeafSchema).max(100),
  conditionNodeSchema,
]);

const visibleIfSchema = z
  .object({
    fieldId: z.string().trim().min(1).max(191),
    op: z.enum(["equals", "notEquals", "in", "notIn"]),
    value: z.union([scalarSchema, z.array(scalarSchema).max(100)]),
  })
  .strict();

const eligibilityBase = {
  id: z.string().trim().min(1).max(191),
  label: z.string().trim().min(1).max(500),
  helpText: z.string().max(2_000).optional(),
  helpUrl: z.string().max(2_000).optional(),
  visibleIf: visibleIfSchema.optional(),
  canonicalKey: z.string().trim().min(1).max(191).optional(),
};

const verdictSchema = z.enum(["eligible", "ineligible", "neutral"]);
const eligibilityQuestionSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...eligibilityBase,
      type: z.literal("boolean"),
      verdictTrue: verdictSchema,
      verdictFalse: verdictSchema,
      canonicalTrue: z.string().max(191).optional(),
      canonicalFalse: z.string().max(191).optional(),
    })
    .strict(),
  z
    .object({
      ...eligibilityBase,
      type: z.literal("select"),
      options: z
        .array(
          z
            .object({
              value: z.string().trim().min(1).max(191),
              label: z.string().trim().min(1).max(500),
              verdict: verdictSchema,
              canonicalValue: z.string().max(191).optional(),
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict(),
]);

const warningSchema = z
  .object({
    id: z.string().trim().min(1).max(191),
    title: z.string().trim().min(1).max(500),
    message: z.string().trim().min(1).max(5_000),
    severity: z.enum(["info", "warning", "critical"]),
    helpUrl: z.string().max(2_000).optional(),
  })
  .strict();

const bundleItemSchema = z
  .object({
    pdfFormId: z.string().trim().min(1).max(191),
    order: z.number().int().min(0).max(10_000),
    required: z.boolean(),
    condition: rawConditionSchema,
  })
  .strict();

const editableBundleFields = {
  name: z.string().trim().min(1).max(500),
  description: z.string().max(5_000).nullable(),
  icon: z.string().max(191).nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  order: z.number().int().min(0).max(10_000),
  active: z.boolean(),
  lifeEventCategory: z.string().max(191).nullable(),
  showOnOnboarding: z.boolean(),
  vocabularyTags: z.array(z.string().trim().min(1).max(191)).max(200),
  eligibilityQuestions: z.array(eligibilityQuestionSchema).max(100),
  warnings: z.array(warningSchema).max(100),
};

export const createBundleSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(191)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: editableBundleFields.name,
    description: editableBundleFields.description.optional().default(null),
    icon: editableBundleFields.icon.optional().default(null),
    color: editableBundleFields.color.optional().default("#7C3AED"),
    order: editableBundleFields.order.optional().default(0),
    lifeEventCategory: editableBundleFields.lifeEventCategory.optional().default(null),
    showOnOnboarding: editableBundleFields.showOnOnboarding.optional().default(false),
    vocabularyTags: editableBundleFields.vocabularyTags.optional().default([]),
    eligibilityQuestions: editableBundleFields.eligibilityQuestions.optional().default([]),
    warnings: editableBundleFields.warnings.optional().default([]),
  })
  .strict();

export const updateBundleSchema = z
  .object({
    name: editableBundleFields.name.optional(),
    description: editableBundleFields.description.optional(),
    icon: editableBundleFields.icon.optional(),
    color: editableBundleFields.color.optional(),
    order: editableBundleFields.order.optional(),
    active: editableBundleFields.active.optional(),
    lifeEventCategory: editableBundleFields.lifeEventCategory.optional(),
    showOnOnboarding: editableBundleFields.showOnOnboarding.optional(),
    vocabularyTags: editableBundleFields.vocabularyTags.optional(),
    eligibilityQuestions: editableBundleFields.eligibilityQuestions.optional(),
    warnings: editableBundleFields.warnings.optional(),
    items: z
      .array(bundleItemSchema)
      .max(200)
      .superRefine((items, ctx) => {
        const seen = new Set<string>();
        for (let index = 0; index < items.length; index++) {
          const id = items[index].pdfFormId;
          if (seen.has(id)) {
            ctx.addIssue({
              code: "custom",
              path: [index, "pdfFormId"],
              message: "Un formulaire PDF ne peut apparaître qu'une fois dans un dossier.",
            });
          }
          seen.add(id);
        }
      })
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Au moins un champ doit être fourni.",
  });

export type BundleUpdateInput = z.infer<typeof updateBundleSchema>;

function normalizeLeafValue<T extends ConditionLeaf | BundleConditionRule>(leaf: T): T {
  if (
    (leaf.op === "in" || leaf.op === "notIn") &&
    typeof leaf.value === "string"
  ) {
    return {
      ...leaf,
      value: leaf.value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    } as T;
  }
  return leaf;
}

function normalizeNode(node: RawConditionNode): ConditionNode {
  if (node.type === "leaf") {
    return normalizeLeafValue(node) as ConditionLeaf;
  }
  return {
    type: node.type,
    rules: node.rules.map(normalizeNode),
  } satisfies ConditionGroup;
}

export function normalizeAdminCondition(condition: unknown): BundleCondition {
  const parsed = rawConditionSchema.parse(condition);
  if (parsed === null) return null;
  if (Array.isArray(parsed)) {
    return parsed.map((leaf) => normalizeLeafValue(leaf)) as BundleConditionRule[];
  }
  return normalizeNode(parsed) as ConditionGroup;
}

function collectConditionSources(condition: BundleCondition, out: string[]): void {
  if (!condition) return;
  if (Array.isArray(condition)) {
    for (const leaf of condition) out.push(leaf.sourceTemplateId);
    return;
  }
  for (const node of condition.rules) {
    if (node.type === "leaf") out.push(node.sourceTemplateId);
    else collectConditionSources(node, out);
  }
}

export function validateBundleItemReferences(
  items: NonNullable<BundleUpdateInput["items"]>,
): { ok: true } | { ok: false; itemIndex: number; sourceId: string } {
  const itemIds = new Set(items.map((item) => item.pdfFormId));
  for (let index = 0; index < items.length; index++) {
    const normalized = normalizeAdminCondition(items[index].condition);
    const sources: string[] = [];
    collectConditionSources(normalized, sources);
    const invalid = sources.find(
      (sourceId) => sourceId === items[index].pdfFormId || !itemIds.has(sourceId),
    );
    if (invalid) return { ok: false, itemIndex: index, sourceId: invalid };
  }
  return { ok: true };
}
