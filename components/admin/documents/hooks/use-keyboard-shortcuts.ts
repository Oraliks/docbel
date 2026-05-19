"use client";

import { useEffect } from "react";
import type { DocumentField } from "@/lib/documents/types";

interface UseKeyboardShortcutsParams {
  selectedFieldId: string | null;
  schema: DocumentField[];
  currentPage: number;
  setSelectedFieldId: (id: string | null) => void;
  onRemove: (id: string) => void;
  onDuplicate: (field: DocumentField) => void;
  onEdit: (field: DocumentField) => void;
  onNudge: (id: string, dx: number, dy: number) => void;
}

/// Vrai si l'élément focusé accepte de la saisie texte — on ignore les
/// raccourcis dans ce cas (sinon Del dans un Input supprime le champ).
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

/// Raccourcis clavier de l'éditeur PDF :
///
///   Suppr / Backspace      Supprime le champ sélectionné
///   Ctrl/Cmd + D            Duplique
///   Ctrl/Cmd + E, Entrée   Édite (ouvre popover)
///   ← ↑ → ↓                  Nudge 1pt en PDF user-space
///   Shift + ← ↑ → ↓          Nudge 10pt
///   Tab / Shift+Tab          Champ suivant / précédent sur la page courante
///   Échap                    Désélectionne
///
/// Les raccourcis sont désactivés quand le focus est dans un Input/Textarea
/// pour ne pas voler les saisies (label dans le popover, recherche sidebar…).
export function useKeyboardShortcuts({
  selectedFieldId,
  schema,
  currentPage,
  setSelectedFieldId,
  onRemove,
  onDuplicate,
  onEdit,
  onNudge,
}: UseKeyboardShortcutsParams) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      // Escape déselectionne (même sans sélection courante, c'est OK)
      if (e.key === "Escape") {
        if (selectedFieldId) {
          setSelectedFieldId(null);
          e.preventDefault();
        }
        return;
      }

      // Navigation Tab entre champs de la page courante (avec ou sans
      // sélection courante)
      if (e.key === "Tab") {
        const onPage = schema.filter(
          (f) => f.position && f.position.page === currentPage
        );
        if (onPage.length === 0) return;
        const idx = selectedFieldId
          ? onPage.findIndex((f) => f.id === selectedFieldId)
          : -1;
        const next = e.shiftKey
          ? (idx <= 0 ? onPage.length - 1 : idx - 1)
          : (idx === -1 || idx === onPage.length - 1 ? 0 : idx + 1);
        setSelectedFieldId(onPage[next].id);
        e.preventDefault();
        return;
      }

      // Tous les autres raccourcis nécessitent un champ sélectionné
      if (!selectedFieldId) return;
      const field = schema.find((f) => f.id === selectedFieldId);
      if (!field) return;

      const cmd = e.metaKey || e.ctrlKey;

      // Suppression
      if (e.key === "Delete" || e.key === "Backspace") {
        onRemove(field.id);
        e.preventDefault();
        return;
      }
      // Dupliquer
      if (cmd && e.key.toLowerCase() === "d") {
        onDuplicate(field);
        e.preventDefault();
        return;
      }
      // Éditer
      if ((cmd && e.key.toLowerCase() === "e") || e.key === "Enter") {
        onEdit(field);
        e.preventDefault();
        return;
      }
      // Nudge flèches
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") {
        onNudge(field.id, -step, 0);
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        onNudge(field.id, step, 0);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        onNudge(field.id, 0, step); // PDF user-space : up = y+
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        onNudge(field.id, 0, -step);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    selectedFieldId,
    schema,
    currentPage,
    setSelectedFieldId,
    onRemove,
    onDuplicate,
    onEdit,
    onNudge,
  ]);
}
