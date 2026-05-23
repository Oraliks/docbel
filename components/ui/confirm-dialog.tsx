"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** Style le bouton de confirmation en rouge (suppression). */
  destructive?: boolean;
  /**
   * Garde-fou type-to-confirm (à la GitHub). Si défini, le bouton de
   * confirmation reste désactivé tant que l'utilisateur n'a pas tapé
   * exactement cette chaîne dans le champ. Casse-insensible aux espaces
   * de début/fin uniquement.
   */
  requireText?: string;
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

  // Garde-fou type-to-confirm. State local au dialog, reset à chaque ouverture.
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const requireText = options?.requireText?.trim() ?? "";
  const matches = requireText ? typed.trim() === requireText : true;

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && hide(false)}>
      {/*
        Largeur élargie par rapport au défaut `data-[size=default]:sm:max-w-sm`
        (384px) : les descriptions de confirmation font typiquement 100-200
        caractères et étouffaient dans la largeur par défaut. À 512px (lg),
        elles tiennent sur 2-3 lignes confortables.
      */}
      <AlertDialogContent className="data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title || "Confirmer ?"}</AlertDialogTitle>
          {options?.description && (
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {requireText && (
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-typed-text" className="text-sm">
              Pour confirmer, tape{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {requireText}
              </code>{" "}
              ci-dessous :
            </Label>
            <Input
              id="confirm-typed-text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
              placeholder={requireText}
              // Vert quand le texte match, neutre sinon. Pas d'erreur agressive
              // pendant que l'user tape (juste pas de match).
              className={matches ? "border-green-400 focus-visible:ring-green-400/50" : undefined}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => hide(false)}>
            {options?.cancelText || "Annuler"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => hide(true)}
            disabled={!matches}
            className={
              options?.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                : "disabled:opacity-50"
            }
          >
            {options?.confirmText || "Confirmer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
