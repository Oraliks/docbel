"use client";

/**
 * Composant invisible qui écoute les raccourcis clavier globaux du chat IA.
 *
 * Raccourcis :
 *   - Ctrl/Cmd+K : nouvelle conversation (onNewSession)
 *   - Ctrl/Cmd+/ : toggle mode chat ↔ prompt (onToggleMode)
 *   - Esc        : ferme les drawers ouverts (onCloseDrawers)
 *   - Ctrl/Cmd+Enter : envoie le message (onSubmit, si fourni)
 *
 * Les raccourcis ne sont PAS interceptés quand l'utilisateur est en train de
 * taper du texte dans un input/textarea/contentEditable — sauf Ctrl+Enter pour
 * envoyer le message, qui reste actif partout (sinon l'utilisateur ne peut pas
 * envoyer sans cliquer le bouton).
 *
 * Esc fait toujours sens même dans un input (ferme drawers + blur input).
 */

import { useEffect } from "react";

interface Props {
  onNewSession?: () => void;
  onToggleMode?: () => void;
  onCloseDrawers?: () => void;
  onSubmit?: () => void;
  /** Désactive temporairement tous les raccourcis (ex: pendant un dialog modal). */
  disabled?: boolean;
}

function isTypingInField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function KeyboardShortcuts({
  onNewSession,
  onToggleMode,
  onCloseDrawers,
  onSubmit,
  disabled,
}: Props) {
  useEffect(() => {
    if (disabled) return;

    function handler(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      const typing = isTypingInField(e.target);

      // Esc : toujours actif (ferme drawers ouverts).
      if (e.key === "Escape" && !e.defaultPrevented) {
        onCloseDrawers?.();
        return;
      }

      // Ctrl+Enter : envoie le message — actif aussi dans les textarea
      // (sinon impossible d'envoyer sans cliquer).
      if (isMod && e.key === "Enter" && onSubmit) {
        e.preventDefault();
        onSubmit();
        return;
      }

      if (!isMod) return;

      // Les raccourcis suivants ne s'activent pas quand on tape du texte.
      if (typing) return;

      switch (e.key.toLowerCase()) {
        case "k":
          if (onNewSession) {
            e.preventDefault();
            onNewSession();
          }
          break;
        case "/":
          if (onToggleMode) {
            e.preventDefault();
            onToggleMode();
          }
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNewSession, onToggleMode, onCloseDrawers, onSubmit, disabled]);

  return null;
}
