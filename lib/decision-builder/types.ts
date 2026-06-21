/// Types TypeScript dérivés des schémas Zod via `z.infer`.
/// Single source of truth = `./schema.ts`. Ne pas définir d'interfaces ici.

import type { z } from "zod";
import type {
  BundleConditionSchema,
  ConditionGroupSchema,
  ConditionLeafSchema,
  ConditionOpSchema,
  DecisionNodeSchema,
  DecisionTreeContentSchema,
  LegacyRuleSchema,
  MatchLevelSchema,
  OptionNodeSchema,
  OrientationAnswerSchema,
  OrientationAnswersSchema,
  QuestionNodeSchema,
  ResultNodeSchema,
} from "./schema";

export type ConditionOp = z.infer<typeof ConditionOpSchema>;
export type ConditionLeaf = z.infer<typeof ConditionLeafSchema>;
export type ConditionGroup = z.infer<typeof ConditionGroupSchema>;
export type LegacyRule = z.infer<typeof LegacyRuleSchema>;
export type BundleCondition = z.infer<typeof BundleConditionSchema>;

export type MatchLevel = z.infer<typeof MatchLevelSchema>;
export type QuestionNode = z.infer<typeof QuestionNodeSchema>;
export type OptionNode = z.infer<typeof OptionNodeSchema>;
export type ResultNode = z.infer<typeof ResultNodeSchema>;
export type DecisionNode = z.infer<typeof DecisionNodeSchema>;

export type DecisionTreeContent = z.infer<typeof DecisionTreeContentSchema>;

export type OrientationAnswer = z.infer<typeof OrientationAnswerSchema>;
export type OrientationAnswers = z.infer<typeof OrientationAnswersSchema>;

/// Statut d'un arbre — miroir du champ `DecisionTree.status` côté DB.
export type DecisionTreeStatus = "draft" | "published" | "archived";

/// Segment d'usage — miroir du champ `DecisionTree.segment`.
/// Valeurs autorisées en V1 : "chomage" (le seul wizard existant).
/// Étendre quand on ouvre à employeur, etc.
export type DecisionTreeSegment = "chomage" | "employeur";
