"use client";

import { create } from "zustand";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** Style le bouton de confirmation en rouge (suppression). */
  destructive?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolver: ((v: boolean) => void) | null;
  show: (opts: ConfirmOptions) => Promise<boolean>;
  hide: (result: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolver: null,
  show: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, options: opts, resolver: resolve });
    }),
  hide: (result) => {
    const r = get().resolver;
    set({ open: false, options: null, resolver: null });
    if (r) r(result);
  },
}));

/// Hook qui retourne une fonction async pour afficher une confirmation shadcn.
///
/// Usage:
/// ```ts
/// const confirm = useConfirm();
/// const ok = await confirm({ title: "Supprimer ?", destructive: true });
/// if (!ok) return;
/// ```
export function useConfirm() {
  return useConfirmStore((s) => s.show);
}

/// Composant à monter UNE FOIS dans le layout (admin + public).
/// Affiche le dialog d'AlertDialog quand `useConfirm()` est appelé n'importe où.
export function ConfirmDialog() {
  const open = useConfirmStore((s) => s.open);
  const options = useConfirmStore((s) => s.options);
  const hide = useConfirmStore((s) => s.hide);

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && hide(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title || "Confirmer ?"}</AlertDialogTitle>
          {options?.description && (
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => hide(false)}>
            {options?.cancelText || "Annuler"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => hide(true)}
            className={
              options?.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {options?.confirmText || "Confirmer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
