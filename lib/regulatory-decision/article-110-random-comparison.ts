export type Article110RandomChoice = "A" | "N" | "B" | "insufficient";

/** A matching answer is an operator observation, never an independent legal validation. */
export function article110RandomChoiceMatches(choice: Article110RandomChoice, category: "A" | "N" | "B" | null): boolean {
  return choice === (category ?? "insufficient");
}
