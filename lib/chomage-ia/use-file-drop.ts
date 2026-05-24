/**
 * Hook utilitaire pour drag-and-drop de fichiers.
 *
 * Encapsule l'état "drag over" + les handlers React standards
 * (`onDragOver`, `onDragLeave`, `onDragEnter`, `onDrop`) en évitant les
 * comportements navigateur par défaut. Le caller passe juste un callback
 * `onFiles(files: File[])` qui reçoit les fichiers déposés.
 *
 * Usage :
 *   const { dragOver, dropHandlers } = useFileDrop({ onFiles: addFiles });
 *   <div {...dropHandlers} className={dragOver ? "..." : "..."} />
 *
 * Extrait du pattern utilisé dans `lookup-import-batch-view.tsx` pour pouvoir
 * être réutilisé sans dupliquer la logique dans le module Chômage IA.
 */

import { useCallback, useRef, useState } from "react";

export interface UseFileDropOptions {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export interface UseFileDropResult {
  dragOver: boolean;
  dropHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

export function useFileDrop({
  onFiles,
  disabled = false,
}: UseFileDropOptions): UseFileDropResult {
  const [dragOver, setDragOver] = useState(false);
  // Compteur d'entrées : permet de gérer correctement le drag sur des enfants
  // imbriqués (dragenter d'un enfant suivi d'un dragleave du parent qui
  // sinon ferait "clignoter" le highlight).
  const dragDepth = useRef(0);

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragOver(true);
    },
    [disabled]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
    },
    [disabled]
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragOver(false);
    },
    [disabled]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        onFiles(Array.from(files));
      }
    },
    [disabled, onFiles]
  );

  return {
    dragOver,
    dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}
