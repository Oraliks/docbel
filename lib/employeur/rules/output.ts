/**
 * Schéma Zod du champ `EmployerRule.outputJson` : une liste d'effets émis quand
 * la condition de la règle est vérifiée. Validé à l'écriture (admin) et à la
 * lecture (moteur) pour garantir des règles bien formées.
 */
import { z } from "zod";

export const ruleOutputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("checklist_item"),
    title: z.string().min(1),
    description: z.string().optional(),
    priority: z.enum(["obligatoire", "recommande", "optionnel"]).default("recommande"),
    sourceCode: z.string().optional(),
    legalBasisRef: z.string().optional(),
    tooltip: z.string().optional(),
  }),
  z.object({
    kind: z.literal("alert"),
    severity: z.enum(["info", "warning", "critical"]).default("info"),
    message: z.string().min(1),
    sourceCode: z.string().optional(),
  }),
  z.object({
    kind: z.literal("reliability"),
    level: z.enum(["low", "medium", "high", "needs_human_validation"]),
  }),
]);

export type RuleOutput = z.infer<typeof ruleOutputSchema>;

/** `outputJson` complet : tableau d'effets. */
export const ruleOutputListSchema = z.array(ruleOutputSchema);

export type RuleOutputList = z.infer<typeof ruleOutputListSchema>;

/** Parse défensif : renvoie [] si le JSON stocké est invalide. */
export function parseRuleOutputs(raw: unknown): RuleOutputList {
  const parsed = ruleOutputListSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}
