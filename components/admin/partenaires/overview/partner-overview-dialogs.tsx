"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PartnerDomain } from "./types";

/**
 * Famille de dialogs pour la page d'overview admin /admin/partenaires.
 *
 * On groupe les 4 dialogs dans un seul fichier (~250 LOC total) plutôt que
 * d'éparpiller en 4 fichiers — ils partagent le même domaine métier et
 * sont tous orchestrés par `<PartnerOverviewShell />`.
 *
 *   - PartnerCreateDialog       : crée un ou plusieurs domaines + organisation
 *   - PartnerEditDomainDialog   : édite un domaine (déplaçable vers autre org)
 *   - PartnerRenameDialog       : renomme une organisation (cascade)
 *   - PartnerDeleteDomainDialog : confirme la suppression d'un domaine
 */

/* ------------------------------------------------------------------ */
/*  Create domain dialog                                               */
/* ------------------------------------------------------------------ */

interface PartnerCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgNames: string[];
  isPending: boolean;
  onCreate: (
    created: Array<PartnerDomain & { organizationName: string }>,
    errors: Array<{ domain: string; error: string }>,
  ) => void;
}

export function PartnerCreateDialog({
  open,
  onOpenChange,
  orgNames,
  isPending,
  onCreate,
}: PartnerCreateDialogProps) {
  const [form, setForm] = useState({
    domains: "",
    organizationName: "",
    notes: "",
    isTest: false,
  });

  // Reset à chaque réouverture pour éviter un formulaire pré-rempli.
  useEffect(() => {
    if (!open) {
      setForm({ domains: "", organizationName: "", notes: "", isTest: false });
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedDomains = form.domains
      .split(/[\s,;]+/)
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter((d) => d.length > 0);

    if (parsedDomains.length === 0) {
      toast.error("Saisissez au moins un domaine");
      return;
    }

    try {
      const res = await fetch("/api/admin/partner-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domains: parsedDomains,
          organizationName: form.organizationName,
          notes: form.notes,
          isTest: form.isTest,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Echec de l'ajout");
        return;
      }

      const created = (data.items ?? [data.item]).map(
        (i: {
          id: string;
          domain: string;
          notes: string | null;
          isTest: boolean;
          isActive: boolean;
          createdAt: string | Date;
          organizationName: string;
        }) => ({
          id: i.id,
          domain: i.domain,
          notes: i.notes,
          isTest: i.isTest,
          isActive: i.isActive,
          createdAt: new Date(i.createdAt).toISOString(),
          organizationName: i.organizationName,
        }),
      );

      onCreate(created, data.errors ?? []);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un ou plusieurs domaines</DialogTitle>
          <DialogDescription>
            Saisissez les domaines sans le @ (ex : <code>cpas.brussels</code>).
            Pour rattacher plusieurs domaines à la même organisation (FGTB
            et ABVV par exemple), tapez-les sur des lignes différentes ou
            séparés par des virgules.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="create-domains">Domaine(s)</Label>
            <Textarea
              id="create-domains"
              placeholder={"fgtb.be\nabvv.be\n…"}
              rows={3}
              value={form.domains}
              onChange={(e) =>
                setForm((f) => ({ ...f, domains: e.target.value }))
              }
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Un domaine par ligne (ou séparés par virgule / espace). Les
              doublons sont ignorés.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-organizationName">Organisation</Label>
            <Input
              id="create-organizationName"
              list="org-suggestions-create"
              placeholder="CPAS de Bruxelles"
              value={form.organizationName}
              onChange={(e) =>
                setForm((f) => ({ ...f, organizationName: e.target.value }))
              }
              required
            />
            <datalist id="org-suggestions-create">
              {orgNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Tapez un nom existant pour grouper avec, ou un nouveau pour créer
              une organisation.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-notes">Notes (optionnel)</Label>
            <Input
              id="create-notes"
              placeholder="Contact, date d'autorisation, etc."
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="create-isTest"
              checked={form.isTest}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, isTest: Boolean(v) }))
              }
            />
            <Label htmlFor="create-isTest" className="cursor-pointer">
              Domaine(s) de test
            </Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              <Plus className="size-4" />
              {isPending ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit domain dialog                                                 */
/* ------------------------------------------------------------------ */

interface PartnerEditDomainDialogProps {
  target: { organizationName: string; domain: PartnerDomain } | null;
  onOpenChange: (open: boolean) => void;
  orgNames: string[];
  isPending: boolean;
  onSave: (input: {
    domain: string;
    organizationName: string;
    notes: string;
    isTest: boolean;
    isActive: boolean;
  }) => void;
}

export function PartnerEditDomainDialog({
  target,
  onOpenChange,
  orgNames,
  isPending,
  onSave,
}: PartnerEditDomainDialogProps) {
  const [form, setForm] = useState({
    domain: "",
    organizationName: "",
    notes: "",
    isTest: false,
    isActive: true,
  });

  useEffect(() => {
    if (target) {
      setForm({
        domain: target.domain.domain,
        organizationName: target.organizationName,
        notes: target.domain.notes ?? "",
        isTest: target.domain.isTest,
        isActive: target.domain.isActive,
      });
    }
  }, [target]);

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le domaine</DialogTitle>
          <DialogDescription>
            Vous pouvez aussi déplacer ce domaine vers une autre organisation
            en changeant son nom.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-domain">Domaine</Label>
            <Input
              id="edit-domain"
              value={form.domain}
              onChange={(e) =>
                setForm((f) => ({ ...f, domain: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-org">Organisation</Label>
            <Input
              id="edit-org"
              list="org-suggestions-edit"
              value={form.organizationName}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  organizationName: e.target.value,
                }))
              }
            />
            <datalist id="org-suggestions-edit">
              {orgNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Input
              id="edit-notes"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="edit-isActive"
                checked={form.isActive}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, isActive: Boolean(v) }))
                }
              />
              <Label htmlFor="edit-isActive" className="cursor-pointer">
                Actif
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-isTest"
                checked={form.isTest}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, isTest: Boolean(v) }))
                }
              />
              <Label htmlFor="edit-isTest" className="cursor-pointer">
                Test
              </Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button onClick={() => onSave(form)} disabled={isPending}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Rename organization dialog                                         */
/* ------------------------------------------------------------------ */

interface PartnerRenameDialogProps {
  from: string | null;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onRename: (to: string) => void;
}

export function PartnerRenameDialog({
  from,
  onOpenChange,
  isPending,
  onRename,
}: PartnerRenameDialogProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue(from ?? "");
  }, [from]);

  return (
    <Dialog open={!!from} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renommer l&apos;organisation</DialogTitle>
          <DialogDescription>
            Le nouveau nom sera appliqué en cascade à tous les domaines et tous
            les utilisateurs de l&apos;organisation. Si le nouveau nom
            correspond à une organisation existante, les deux fusionneront.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rename-from">Nom actuel</Label>
            <Input id="rename-from" value={from ?? ""} disabled readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rename-to">Nouveau nom</Label>
            <Input
              id="rename-to"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button onClick={() => onRename(value)} disabled={isPending}>
            Renommer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete domain confirmation dialog                                  */
/* ------------------------------------------------------------------ */

interface PartnerDeleteDomainDialogProps {
  target: PartnerDomain | null;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: () => void;
}

export function PartnerDeleteDomainDialog({
  target,
  onOpenChange,
  isPending,
  onConfirm,
}: PartnerDeleteDomainDialogProps) {
  return (
    <AlertDialog open={!!target} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce domaine ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le domaine <strong>@{target?.domain}</strong> sera définitivement
            retiré. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
