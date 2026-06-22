"use client";

/**
 * Dialog Shadcn pour créer / éditer un KnowledgeFolder (migration 21).
 *
 * Mode `create` :
 *   - Saisie du nom (Input)
 *   - Palette de 8 couleurs Tailwind
 *   - Picker de 12 icônes lucide
 *   - Select du parent (folders compatibles — pas de cycle + < niveau max)
 *
 * Mode `edit` :
 *   - Mêmes champs initialisés depuis le folder existant.
 *   - Suppression du folder courant et de ses descendants du select parent
 *     pour éviter les cycles côté UI (l'API le revalide aussi).
 *
 * Validation max 3 niveaux : si le sous-arbre du folder courant + nouveau parent
 * dépasse, l'API renvoie une erreur, qu'on affiche en toast.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Folder,
  BookOpen,
  FileText,
  Briefcase,
  Scale,
  Building2,
  GraduationCap,
  Globe,
  ShieldCheck,
  Calculator,
  Lightbulb,
  Star,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnowledgeFolderListItem } from "@/lib/chomage-ia/types";

type ColorKey =
  | "colorBlue"
  | "colorViolet"
  | "colorGreen"
  | "colorAmber"
  | "colorRed"
  | "colorCyan"
  | "colorPink"
  | "colorGray";

/** Palette de 8 couleurs (hex Tailwind 500). */
const FOLDER_COLORS: Array<{ value: string; labelKey: ColorKey }> = [
  { value: "#3b82f6", labelKey: "colorBlue" },
  { value: "#a855f7", labelKey: "colorViolet" },
  { value: "#22c55e", labelKey: "colorGreen" },
  { value: "#f59e0b", labelKey: "colorAmber" },
  { value: "#ef4444", labelKey: "colorRed" },
  { value: "#06b6d4", labelKey: "colorCyan" },
  { value: "#ec4899", labelKey: "colorPink" },
  { value: "#64748b", labelKey: "colorGray" },
];

/** 12 icônes lucide pertinentes pour des dossiers de KB. */
const FOLDER_ICONS = [
  { name: "Folder", Icon: Folder },
  { name: "BookOpen", Icon: BookOpen },
  { name: "FileText", Icon: FileText },
  { name: "Briefcase", Icon: Briefcase },
  { name: "Scale", Icon: Scale },
  { name: "Building2", Icon: Building2 },
  { name: "GraduationCap", Icon: GraduationCap },
  { name: "Globe", Icon: Globe },
  { name: "ShieldCheck", Icon: ShieldCheck },
  { name: "Calculator", Icon: Calculator },
  { name: "Lightbulb", Icon: Lightbulb },
  { name: "Star", Icon: Star },
] as const;

export type FolderFormMode = "create" | "edit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: FolderFormMode;
  domain: string;
  /** Tous les folders du domaine — sert au Select "Parent" + filtrage descendants. */
  allFolders: KnowledgeFolderListItem[];
  /** Folder courant en mode edit, ou parent initial en mode create (null = racine). */
  current?: KnowledgeFolderListItem | null;
  /** En mode create, parent initial. */
  initialParentId?: string | null;
  /** Callback après création / édition réussie (le parent refresh la liste). */
  onSuccess: () => void;
}

export function FolderFormDialog({
  open,
  onOpenChange,
  mode,
  domain,
  allFolders,
  current = null,
  initialParentId = null,
  onSuccess,
}: Props) {
  const t = useTranslations("admin.chomageIa");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(FOLDER_COLORS[0].value);
  const [icon, setIcon] = useState<string>(FOLDER_ICONS[0].name);
  const [parentId, setParentId] = useState<string | null>(initialParentId);
  const [submitting, setSubmitting] = useState(false);

  // Reset state quand le dialog s'ouvre (et bind au folder courant en edit).
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && current) {
      setName(current.name);
      setColor(current.color || FOLDER_COLORS[0].value);
      setIcon(current.icon || FOLDER_ICONS[0].name);
      setParentId(current.parentId);
    } else {
      setName("");
      setColor(FOLDER_COLORS[0].value);
      setIcon(FOLDER_ICONS[0].name);
      setParentId(initialParentId);
    }
  }, [open, mode, current, initialParentId]);

  /**
   * Calcule l'ensemble des folder IDs qui sont des descendants du folder courant.
   * On les exclut du select parent pour éviter les cycles.
   * (L'API revalide aussi côté serveur — c'est juste une commodité UX.)
   */
  const excludedIds = useMemo(() => {
    if (mode !== "edit" || !current) return new Set<string>();
    const set = new Set<string>([current.id]);
    let frontier = [current.id];
    for (let i = 0; i < 5; i++) {
      const children = allFolders.filter(
        (f) => f.parentId && frontier.includes(f.parentId),
      );
      if (children.length === 0) break;
      frontier = [];
      for (const c of children) {
        if (!set.has(c.id)) {
          set.add(c.id);
          frontier.push(c.id);
        }
      }
    }
    return set;
  }, [mode, current, allFolders]);

  const parentOptions = useMemo(() => {
    return allFolders.filter((f) => !excludedIds.has(f.id));
  }, [allFolders, excludedIds]);

  async function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error(t("folderNameRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const url =
        mode === "create"
          ? "/api/chomage-ia/kb-folders"
          : `/api/chomage-ia/kb-folders/${current!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const body =
        mode === "create"
          ? { name: trimmed, color, icon, parentId, domain }
          : { name: trimmed, color, icon, parentId };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast.success(mode === "create" ? t("folderCreated") : t("folderUpdated"));
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      toast.error(t("failure"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("folderNewTitle") : t("folderEditTitle")}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {t("folderFormDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Nom */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="folder-name" className="text-[12px]">
              {t("nameLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="folder-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              placeholder={t("folderNamePlaceholder")}
              className="h-9"
            />
          </div>

          {/* Couleur */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px]">{t("colorLabel")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  aria-label={t(c.labelKey)}
                  title={t(c.labelKey)}
                  className={cn(
                    "size-7 rounded-md ring-2 ring-transparent transition-all",
                    color === c.value &&
                      "ring-offset-2 ring-offset-background ring-foreground/60 scale-110",
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          {/* Icône */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px]">{t("iconLabel")}</Label>
            <div className="grid grid-cols-6 gap-1.5">
              {FOLDER_ICONS.map(({ name: n, Icon }) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIcon(n)}
                  aria-label={n}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md border transition-colors",
                    icon === n
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Parent */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="folder-parent" className="text-[12px]">
              {t("parentFolderLabel")}
            </Label>
            <Select
              value={parentId ?? "__root__"}
              onValueChange={(v) =>
                setParentId(!v || v === "__root__" ? null : v)
              }
            >
              <SelectTrigger id="folder-parent" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">{t("rootNoParent")}</SelectItem>
                {parentOptions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10.5px] text-muted-foreground">
              {t("maxDepthHint")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {mode === "create" ? t("creating") : t("saving")}
              </>
            ) : mode === "create" ? (
              t("create")
            ) : (
              t("save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helper public : retourne le composant lucide correspondant au nom stocké
 * dans `KnowledgeFolder.icon`. Fallback sur Folder si inconnu / null.
 */
export function getFolderIcon(name: string | null | undefined) {
  if (!name) return Folder;
  const found = FOLDER_ICONS.find((i) => i.name === name);
  return found ? found.Icon : Folder;
}

/**
 * Helper public : retourne la couleur effective d'un folder (avec fallback).
 */
export function getFolderColor(color: string | null | undefined): string {
  return color && color.length > 0 ? color : "#64748b"; // slate-500 par défaut
}
