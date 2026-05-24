/**
 * Types client du générateur de prompts Claude Code.
 */

import type { CitedSourceLite } from "../chat/types";

export interface PromptHistoryItem {
  id: string;
  title: string;
  brief: string;
  domain: string;
  citedCount: number;
  createdAt: string;
}

export interface GeneratedPromptFull {
  id: string;
  title: string;
  brief: string;
  output: string;
  domain: string;
  citedSources: CitedSourceLite[];
  createdAt: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheRead?: number;
    cacheCreate?: number;
  };
}
