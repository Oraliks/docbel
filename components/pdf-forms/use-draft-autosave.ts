"use client";

import type { FormPayload } from "@/lib/pdf-forms/types";

export interface DraftAutosave {
  lastSavedAt: Date | null;
  scheduleSave: (stepId: string | null, field: string) => void;
  flushDraft: () => void;
  discardDraft: () => void;
  resetSavedAt: () => void;
}

const EPHEMERAL_DRAFT: DraftAutosave = {
  lastSavedAt: null,
  scheduleSave: () => {},
  flushDraft: () => {},
  discardDraft: () => {},
  resetSavedAt: () => {},
};

// V1 publique : les valeurs restent dans l'état React du runner. Aucun envoi,
// minuteur, flush à la fermeture ou suppression d'un ancien brouillon serveur.
export function useDraftAutosave(options: {
  slug: string;
  bundleRunId?: string;
  values: FormPayload;
}): DraftAutosave {
  void options;
  return EPHEMERAL_DRAFT;
}
