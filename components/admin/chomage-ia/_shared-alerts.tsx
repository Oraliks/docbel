"use client";

/**
 * Composants AlertDialog mutualisés pour le module Assistant IA Chômage.
 *
 * - `<ConfirmDeleteDialog>` : confirme une suppression destructive.
 *   Usage : open/onOpenChange contrôlé, onConfirm async (gère pending state).
 *
 * - `<RenameDialog>` : prompt avec input pour renommer une entité (session, etc).
 *   Évite les `prompt()` natifs (peu jolis, pas customisables).
 *
 * Le projet a aussi un `useConfirm()` global (`components/ui/confirm-dialog.tsx`)
 * basé sur Zustand — préférable pour la majorité des cas car évite le boilerplate
 * de state. Les composants ici sont utiles quand on veut un dialog inline
 * scopé à un composant (ex: contextes complexes ou state local d'erreur).
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
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

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** Async callback. Le dialog reste ouvert avec spinner pendant l'exécution. */
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Supprimer",
  cancelText = "Annuler",
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [pending, setPending] = useState(false);

  // Reset pending si le parent ferme via Esc/clic backdrop.
  function handleOpenChange(next: boolean) {
    if (pending) return; // Empêche fermeture pendant une suppression en cours.
    if (!next) setPending(false);
    onOpenChange(next);
  }

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // L'appelant gère le toast d'erreur. On laisse le dialog ouvert pour
      // permettre une nouvelle tentative.
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Suppression…
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  initialValue: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void | Promise<void>;
}

export function RenameDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Nouveau nom",
  initialValue,
  placeholder,
  confirmText = "Renommer",
  cancelText = "Annuler",
  onConfirm,
}: RenameDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        {/*
          Forme contrôlée + remount via key={initialValue} pour resync naturel
          du state interne sans useEffect (préférable côté React Compiler).
          Le sous-composant `<RenameBody>` est démonté/remonté à chaque
          changement d'initialValue, ce qui réinitialise `value` et `pending`.
        */}
        {open ? (
          <RenameBody
            key={initialValue}
            title={title}
            description={description}
            label={label}
            initialValue={initialValue}
            placeholder={placeholder}
            confirmText={confirmText}
            cancelText={cancelText}
            onConfirm={onConfirm}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RenameBody({
  title,
  description,
  label,
  initialValue,
  placeholder,
  confirmText,
  cancelText,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: string;
  label: string;
  initialValue: string;
  placeholder?: string;
  confirmText: string;
  cancelText: string;
  onConfirm: (value: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);

  const trimmed = value.trim();
  const canConfirm = trimmed.length > 0 && trimmed !== initialValue.trim();

  async function handleConfirm() {
    if (!canConfirm) return;
    setPending(true);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch {
      setPending(false);
    }
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description ? (
          <AlertDialogDescription>{description}</AlertDialogDescription>
        ) : null}
      </AlertDialogHeader>
      <div className="space-y-2 py-1">
        <Label htmlFor="rename-input" className="text-sm">
          {label}
        </Label>
        <Input
          id="rename-input"
          value={value}
          autoFocus
          placeholder={placeholder}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canConfirm) {
              e.preventDefault();
              handleConfirm();
            }
          }}
        />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{cancelText}</AlertDialogCancel>
        <AlertDialogAction
          onClick={handleConfirm}
          disabled={!canConfirm || pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Enregistrement…
            </>
          ) : (
            confirmText
          )}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
