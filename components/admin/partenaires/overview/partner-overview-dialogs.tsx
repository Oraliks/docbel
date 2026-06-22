"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TypeToConfirmField, typeToConfirmMatches } from "@/components/ui/type-to-confirm-field";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PARTNER_TYPE_OPTIONS,
  type PartnerDomain,
  type PartnerDomainKind,
  type PartnerSegment,
} from "./types";

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
  /** Segment pré-sélectionné (et appliqué au reset). Défaut "partenaire". */
  defaultSegment?: PartnerSegment;
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
  defaultSegment = "partenaire",
  onCreate,
}: PartnerCreateDialogProps) {
  const t = useTranslations("admin.partenaires");
  const [form, setForm] = useState({
    kind: "domain" as PartnerDomainKind,
    domains: "",
    email: "",
    segment: defaultSegment as PartnerSegment,
    partnerType: "" as string,
    organizationName: "",
    notes: "",
    isTest: false,
  });

  // Reset à chaque réouverture pour éviter un formulaire pré-rempli.
  useEffect(() => {
    if (!open) {
      setForm({
        kind: "domain",
        domains: "",
        email: "",
        segment: defaultSegment,
        partnerType: "",
        organizationName: "",
        notes: "",
        isTest: false,
      });
    }
  }, [open, defaultSegment]);

  const isEmailKind = form.kind === "email";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // partnerType n'a de sens que pour le segment "partenaire".
    const partnerType =
      form.segment === "partenaire" && form.partnerType
        ? form.partnerType
        : null;

    let payload: Record<string, unknown>;

    if (isEmailKind) {
      const email = form.email.trim().toLowerCase();
      if (!email) {
        toast.error(t("toastEnterEmail"));
        return;
      }
      payload = {
        kind: "email",
        email,
        segment: form.segment,
        partnerType,
        organizationName: form.organizationName,
        notes: form.notes,
        isTest: form.isTest,
      };
    } else {
      const parsedDomains = form.domains
        .split(/[\s,;]+/)
        .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
        .filter((d) => d.length > 0);

      if (parsedDomains.length === 0) {
        toast.error(t("toastEnterDomain"));
        return;
      }
      payload = {
        kind: "domain",
        domains: parsedDomains,
        segment: form.segment,
        partnerType,
        organizationName: form.organizationName,
        notes: form.notes,
        isTest: form.isTest,
      };
    }

    try {
      const res = await fetch("/api/admin/partner-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("toastAddFailed"));
        return;
      }

      const created = (data.items ?? [data.item]).map(
        (i: {
          id: string;
          kind: PartnerDomainKind;
          domain: string | null;
          email: string | null;
          segment: PartnerSegment;
          partnerType: string | null;
          notes: string | null;
          isTest: boolean;
          isActive: boolean;
          createdAt: string | Date;
          organizationName: string;
        }) => ({
          id: i.id,
          kind: i.kind,
          domain: i.domain,
          email: i.email,
          segment: i.segment,
          partnerType: i.partnerType,
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
      toast.error(t("toastNetworkError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>
            {t.rich("createDescription", {
              strong: (chunks) => <strong>{chunks}</strong>,
              code: (chunks) => <code>{chunks}</code>,
            })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type d'entrée : domaine entier vs adresse email --------- */}
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
            <Label htmlFor="create-kind" className="cursor-pointer">
              {isEmailKind ? t("kindEmail") : t("kindDomain")}
            </Label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={isEmailKind ? "" : "font-semibold text-foreground"}>
                {t("kindDomainShort")}
              </span>
              <Switch
                id="create-kind"
                checked={isEmailKind}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, kind: v ? "email" : "domain" }))
                }
              />
              <span className={isEmailKind ? "font-semibold text-foreground" : ""}>
                {t("kindEmailShort")}
              </span>
            </div>
          </div>

          {isEmailKind ? (
            <div className="space-y-1.5">
              <Label htmlFor="create-email">{t("kindEmail")}</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="prenom.nom@gmail.com"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {t("emailHint")}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="create-domains">{t("domainsLabel")}</Label>
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
                {t("domainsHint")}
              </p>
            </div>
          )}

          {/* Segment + sous-type partenaire --------------------------- */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-segment">{t("segmentLabel")}</Label>
              <Select
                value={form.segment}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    segment: (v as PartnerSegment) ?? "partenaire",
                    // partnerType n'a de sens que pour "partenaire".
                    partnerType: v === "partenaire" ? f.partnerType : "",
                  }))
                }
              >
                <SelectTrigger id="create-segment" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="partenaire">{t("segmentPartner")}</SelectItem>
                  <SelectItem value="employeur">{t("segmentEmployer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.segment === "partenaire" && (
              <div className="space-y-1.5">
                <Label htmlFor="create-partnerType">{t("subtypeLabel")}</Label>
                <Select
                  value={form.partnerType || undefined}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, partnerType: v ?? "" }))
                  }
                >
                  <SelectTrigger id="create-partnerType" className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNER_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-organizationName">{t("organizationLabel")}</Label>
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
              {t("organizationHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-notes">{t("notesOptionalLabel")}</Label>
            <Input
              id="create-notes"
              placeholder={t("notesPlaceholder")}
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
              {t("testEntryLabel")}
            </Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              <Plus className="size-4" />
              {isPending ? t("adding") : t("add")}
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
    kind: PartnerDomainKind;
    domain: string;
    email: string;
    segment: PartnerSegment;
    partnerType: string | null;
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
  const t = useTranslations("admin.partenaires");
  const [form, setForm] = useState({
    kind: "domain" as PartnerDomainKind,
    domain: "",
    email: "",
    segment: "partenaire" as PartnerSegment,
    partnerType: "" as string,
    organizationName: "",
    notes: "",
    isTest: false,
    isActive: true,
  });

  useEffect(() => {
    if (target) {
      setForm({
        kind: target.domain.kind,
        domain: target.domain.domain ?? "",
        email: target.domain.email ?? "",
        segment: target.domain.segment,
        partnerType: target.domain.partnerType ?? "",
        organizationName: target.organizationName,
        notes: target.domain.notes ?? "",
        isTest: target.domain.isTest,
        isActive: target.domain.isActive,
      });
    }
  }, [target]);

  const isEmailKind = form.kind === "email";

  function handleSave() {
    onSave({
      kind: form.kind,
      domain: form.domain,
      email: form.email,
      segment: form.segment,
      partnerType:
        form.segment === "partenaire" && form.partnerType
          ? form.partnerType
          : null,
      organizationName: form.organizationName,
      notes: form.notes,
      isTest: form.isTest,
      isActive: form.isActive,
    });
  }

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>
            {t("editDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Type d'entrée : domaine entier vs adresse email --------- */}
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
            <Label htmlFor="edit-kind" className="cursor-pointer">
              {isEmailKind ? t("kindEmail") : t("kindDomain")}
            </Label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={isEmailKind ? "" : "font-semibold text-foreground"}>
                {t("kindDomainShort")}
              </span>
              <Switch
                id="edit-kind"
                checked={isEmailKind}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, kind: v ? "email" : "domain" }))
                }
              />
              <span className={isEmailKind ? "font-semibold text-foreground" : ""}>
                {t("kindEmailShort")}
              </span>
            </div>
          </div>

          {isEmailKind ? (
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">{t("kindEmail")}</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="prenom.nom@gmail.com"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="edit-domain">{t("domainLabel")}</Label>
              <Input
                id="edit-domain"
                placeholder="cpas.brussels"
                value={form.domain}
                onChange={(e) =>
                  setForm((f) => ({ ...f, domain: e.target.value }))
                }
              />
            </div>
          )}

          {/* Segment + sous-type partenaire --------------------------- */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-segment">{t("segmentLabel")}</Label>
              <Select
                value={form.segment}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    segment: (v as PartnerSegment) ?? "partenaire",
                    partnerType: v === "partenaire" ? f.partnerType : "",
                  }))
                }
              >
                <SelectTrigger id="edit-segment" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="partenaire">{t("segmentPartner")}</SelectItem>
                  <SelectItem value="employeur">{t("segmentEmployer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.segment === "partenaire" && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-partnerType">{t("subtypeLabel")}</Label>
                <Select
                  value={form.partnerType || undefined}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, partnerType: v ?? "" }))
                  }
                >
                  <SelectTrigger id="edit-partnerType" className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNER_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-org">{t("organizationLabel")}</Label>
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
            <Label htmlFor="edit-notes">{t("notesLabel")}</Label>
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
                {t("activeLabel")}
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
                {t("testLabel")}
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
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {t("save")}
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
  const t = useTranslations("admin.partenaires");
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue(from ?? "");
  }, [from]);

  return (
    <Dialog open={!!from} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("renameTitle")}</DialogTitle>
          <DialogDescription>
            {t("renameDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rename-from">{t("currentNameLabel")}</Label>
            <Input id="rename-from" value={from ?? ""} disabled readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rename-to">{t("newNameLabel")}</Label>
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
            {t("cancel")}
          </Button>
          <Button onClick={() => onRename(value)} disabled={isPending}>
            {t("rename")}
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
  const t = useTranslations("admin.partenaires");
  const [typed, setTyped] = useState("");
  // Reset du champ type-to-confirm à chaque changement de cible.
  useEffect(() => {
    setTyped("");
  }, [target]);

  const needle =
    (target?.kind === "email" ? target?.email : target?.domain) ||
    t("deleteFallbackWord");

  const entry =
    target?.kind === "email"
      ? (target?.email ?? "—")
      : target?.domain
        ? `@${target.domain}`
        : "—";

  return (
    <AlertDialog open={!!target} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.rich("deleteDescription", {
              entry,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {target ? (
          <TypeToConfirmField
            requireText={needle}
            value={typed}
            onChange={setTyped}
            disabled={isPending}
          />
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending || !typeToConfirmMatches(typed, needle)}
          >
            {t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
