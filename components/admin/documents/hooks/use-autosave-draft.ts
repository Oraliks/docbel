"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { DocumentField } from "@/lib/documents/types";

interface DraftPayload {
  schema: DocumentField[];
  savedAt: number;
  templateVersion: number;
}

const KEY_PREFIX = "beldoc-template-draft:";
const DEBOUNCE_MS = 3000;

function storageKey(templateId: string): string {
  return `${KEY_PREFIX}${templateId}`;
}

function readDraft(templateId: string): DraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(templateId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    if (!Array.isArray(parsed.schema)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(templateId: string, payload: DraftPayload) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(templateId), JSON.stringify(payload));
  } catch {
    /* quota plein → on lâche silencieusement */
  }
}

function clearDraft(templateId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(templateId));
  } catch {
    /* ignore */
  }
}

interface UseAutosaveDraftParams {
  templateId: string;
  templateVersion: number;
  schema: DocumentField[];
  dirty: boolean;
  onRestore: (schema: DocumentField[]) => void;
}

/// Sauve périodiquement le schema en cours dans localStorage et propose de
/// restaurer si un brouillon non-sauvé est trouvé au prochain chargement.
///
/// Stratégie :
///   1. Au mount : check si un draft existe (et > schema actuel en chrono)
///      → toast avec bouton "Restaurer" / "Ignorer"
///   2. Pendant l'édition : write toutes les `DEBOUNCE_MS` quand `dirty=true`
///   3. Quand `dirty` redevient false (= save serveur réussie) : clear le draft
export function useAutosaveDraft({
  templateId,
  templateVersion,
  schema,
  dirty,
  onRestore,
}: UseAutosaveDraftParams) {
  /// On ne propose la restauration qu'une seule fois au mount, pas à chaque
  /// changement de templateId (qui ne devrait pas changer dans la session).
  const restoreCheckedRef = useRef(false);

  // 1. Check restore au mount
  useEffect(() => {
    if (restoreCheckedRef.current) return;
    restoreCheckedRef.current = true;
    const draft = readDraft(templateId);
    if (!draft) return;
    // Le draft doit être à la même version, sinon il vient d'avant un save
    // qui a incrémenté la version → on l'ignore (potentiellement obsolète).
    if (draft.templateVersion !== templateVersion) {
      clearDraft(templateId);
      return;
    }
    // Si schema sur disque identique au courant → rien à proposer
    if (JSON.stringify(draft.schema) === JSON.stringify(schema)) {
      return;
    }
    const age = Date.now() - draft.savedAt;
    const minutes = Math.max(1, Math.round(age / 60_000));
    toast.message(
      `Brouillon trouvé (${draft.schema.length} champs, il y a ${minutes} min)`,
      {
        duration: 12_000,
        action: {
          label: "Restaurer",
          onClick: () => {
            onRestore(draft.schema);
            clearDraft(templateId);
            toast.success("Brouillon restauré");
          },
        },
        cancel: {
          label: "Ignorer",
          onClick: () => clearDraft(templateId),
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // 2. Autosave debounced
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      writeDraft(templateId, {
        schema,
        savedAt: Date.now(),
        templateVersion,
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [schema, dirty, templateId, templateVersion]);

  // 3. Clear quand dirty redevient false (save serveur réussi)
  useEffect(() => {
    if (!dirty) clearDraft(templateId);
  }, [dirty, templateId]);
}
