"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpenCheck,
  ChevronDown,
  ExternalLink,
  MoreVertical,
  Pencil,
  Settings2,
  Star,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TableCell, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IconDisplay,
  IconPicker,
} from "@/components/admin/documents/icon-picker";
import { cn } from "@/lib/utils";
import type { AudienceId } from "@/lib/audience";
import {
  type AccessRule,
  PARTNER_TYPES,
  type PartnerType,
  effectiveRules,
} from "@/lib/entitlements";
import {
  PARTNER_TYPE_LABEL,
  SEGMENT_LABEL,
  hasSegment,
  selectedPartnerTypes,
  toggleSegment,
  togglePartnerType,
  typeBadgeVariant,
  typeLabel,
} from "./shared";
import type { FlatTool } from "./types";

/** Mapping slug → page admin de configuration spécifique (menu kebab). */
const CONFIG_URL: Record<string, string> = {
  preavis: "/admin/chomage/preavis",
  bureaux: "/outils/bureaux",
};

/** Teinte douce de la tuile icône par audience legacy (juste cosmétique). */
const TILE_TONE: Record<AudienceId, string> = {
  citoyen: "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  employeur:
    "bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  partenaire:
    "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

interface ToolRowProps {
  tool: FlatTool;
  /** Sections disponibles pour réassigner la catégorie de l'outil. */
  sections: { id: string; name: string }[];
  selected: boolean;
  onSelectChange: (next: boolean) => void;
}

/**
 * Une ligne `<TableRow>` de la table admin /outils. Porte tout l'état éditable
 * d'un outil (active, populaire, accès set-based, nom, icône, description) et
 * persiste chaque modif via PATCH /api/tools/[slug] + router.refresh().
 *
 * Les 3 colonnes de toggles (Citoyen/Employeur/Partenaire) pilotent le modèle
 * `access`. L'état affiché part des règles EFFECTIVES (`effectiveRules`) — donc
 * un outil "citoyen" via l'audience legacy montre bien Citoyen ON ; toute
 * modification matérialise alors l'accès explicite (l'audience legacy ne sert
 * plus de fallback une fois `access` non vide).
 */
export function ToolRow({ tool, sections, selected, onSelectChange }: ToolRowProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [active, setActive] = useState(tool.active);
  const [popular, setPopular] = useState(tool.popular);
  const [name, setName] = useState(tool.name);
  const [description, setDescription] = useState(tool.description);
  const [icon, setIcon] = useState<string | null>(tool.icon ?? null);
  const [sectionId, setSectionId] = useState(tool.sectionId);
  const [access, setAccess] = useState<AccessRule[]>(() => effectiveRules(tool));
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [descOpen, setDescOpen] = useState(false);

  // Resynchronise l'état des toggles (actif/populaire/section/accès) quand le
  // serveur renvoie un nouveau `tool` (après router.refresh, y compris déclenché
  // par une action GROUPÉE ou une modif d'un autre onglet). `tool` ne change
  // d'identité qu'au refresh serveur, pas aux re-renders locaux (sélection…),
  // donc pas de boucle. On NE touche pas name/description/icon pour ne pas
  // écraser une édition inline en cours.
  useEffect(() => {
    setActive(tool.active);
    setPopular(tool.popular);
    setSectionId(tool.sectionId);
    setAccess(effectiveRules(tool));
  }, [tool]);

  async function patch(body: {
    active?: boolean;
    popular?: boolean;
    name?: string;
    description?: string;
    icon?: string | null;
    sectionId?: string;
    access?: AccessRule[];
  }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tools/${tool.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Échec mise à jour");
      }
    } catch (err) {
      if ("active" in body) setActive(!body.active);
      if ("popular" in body) setPopular(!body.popular);
      toast.error(err instanceof Error ? err.message : "Erreur");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function saveName(next: string) {
    const trimmed = next.trim();
    if (!trimmed || trimmed === name) {
      setName(name);
      return;
    }
    try {
      await patch({ name: trimmed });
      toast.success("Titre mis à jour");
      router.refresh();
    } catch {
      setName(tool.name);
    }
  }

  async function saveDescription(next: string) {
    const trimmed = next.trim();
    if (!trimmed || trimmed === description) {
      setDescription(description);
      setDescOpen(false);
      return;
    }
    try {
      await patch({ description: trimmed });
      toast.success("Description mise à jour");
      router.refresh();
    } catch {
      setDescription(tool.description);
    } finally {
      setDescOpen(false);
    }
  }

  async function saveIcon(next: string | null) {
    if (next === icon) return;
    const previous = icon;
    setIcon(next);
    try {
      await patch({ icon: next });
      toast.success(next ? "Icône mise à jour" : "Icône retirée");
      router.refresh();
    } catch {
      setIcon(previous);
    }
  }

  async function saveSectionId(next: string) {
    if (!next || next === sectionId) return;
    const previous = sectionId;
    setSectionId(next);
    try {
      await patch({ sectionId: next });
      toast.success("Catégorie mise à jour");
      router.refresh();
    } catch {
      setSectionId(previous);
    }
  }

  async function toggleActive(next: boolean) {
    setActive(next);
    try {
      await patch({ active: next });
      toast.success(next ? `${tool.name} activé` : `${tool.name} désactivé`);
      router.refresh();
    } catch {
      /* patch() a déjà rollback l'état + affiché toast.error */
    }
  }

  async function togglePopular() {
    const next = !popular;
    setPopular(next);
    try {
      await patch({ popular: next });
      toast.success(next ? "Marqué populaire" : "Retiré des populaires");
      router.refresh();
    } catch {
      /* idem : rollback géré par patch() */
    }
  }

  async function saveAccess(next: AccessRule[]) {
    const previous = access;
    setAccess(next);
    try {
      await patch({ access: next });
      toast.success("Accès mis à jour");
      // Re-fetch serveur → resync des compteurs par segment + filtre Audience.
      router.refresh();
    } catch {
      setAccess(previous);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Supprimer "${tool.name}" ?`,
      description:
        "Le template associé (et tous ses générés, révisions, items de bundle) sera aussi supprimé en cascade. Cette action est irréversible.",
      confirmText: "Supprimer définitivement",
      destructive: true,
      requireText: tool.name,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tools/${tool.slug}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Échec suppression");
      }
      setDeleted(true);
      toast.success(`${tool.name} supprimé`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setSaving(false);
    }
  }

  if (deleted) return null;

  const tone = TILE_TONE[tool.audience] ?? TILE_TONE.citoyen;
  const configUrl = CONFIG_URL[tool.slug];
  const showMethodology = tool.type.startsWith("calc_");

  return (
    <TableRow data-state={selected ? "selected" : undefined} className={active ? "" : "opacity-60"}>
      {/* Sélection */}
      <TableCell className="w-8">
        <Checkbox
          checked={selected}
          onCheckedChange={(c) => onSelectChange(Boolean(c))}
          aria-label={`Sélectionner ${tool.name}`}
        />
      </TableCell>

      {/* Nom : icône + titre éditable */}
      <TableCell>
        <div className="flex items-center gap-2.5">
          <IconPickerTile
            value={icon}
            onChange={saveIcon}
            disabled={saving}
            tone={tone}
          />
          <div>
            <EditableInline
              value={name}
              onSave={saveName}
              onChange={setName}
              placeholder="Titre de l'outil…"
              ariaLabel="Éditer le titre"
              disabled={saving}
              className="text-[13px] font-semibold text-foreground"
            />
            <p className="font-mono text-[10.5px] text-muted-foreground">
              {tool.slug}
            </p>
          </div>
        </div>
      </TableCell>

      {/* Type */}
      <TableCell>
        <Badge variant={typeBadgeVariant(tool.type)}>
          {typeLabel(tool.type)}
        </Badge>
      </TableCell>

      {/* Catégorie (= section, réassignable) */}
      <TableCell>
        <Select
          value={sectionId}
          onValueChange={(v) => saveSectionId(v ?? "")}
          disabled={saving}
        >
          <SelectTrigger
            aria-label="Changer la catégorie"
            className="h-7 w-[150px] border-transparent bg-transparent px-2 text-[12px] text-muted-foreground shadow-none hover:border-border hover:bg-card focus:border-border"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Actif */}
      <TableCell className="text-center">
        <div className="flex justify-center">
          <Switch
            checked={active}
            onCheckedChange={toggleActive}
            disabled={saving}
            aria-label={active ? "Désactiver l'outil" : "Activer l'outil"}
          />
        </div>
      </TableCell>

      {/* Populaire */}
      <TableCell className="text-center">
        <button
          type="button"
          onClick={togglePopular}
          disabled={saving}
          aria-pressed={popular}
          aria-label={popular ? "Retirer des populaires" : "Marquer populaire"}
          title={popular ? "Retirer des populaires" : "Marquer populaire"}
          className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
        >
          <Star
            className={cn(
              "size-4",
              popular ? "fill-amber-400 text-amber-500" : "text-muted-foreground/50",
            )}
          />
        </button>
      </TableCell>

      {/* Toggles segments d'accès */}
      <SegmentCell
        segment="citoyen"
        access={access}
        onToggle={saveAccess}
        disabled={saving}
      />
      <SegmentCell
        segment="employeur"
        access={access}
        onToggle={saveAccess}
        disabled={saving}
      />
      <SegmentCell
        segment="partenaire"
        access={access}
        onToggle={saveAccess}
        disabled={saving}
      />

      {/* Actions */}
      <TableCell className="w-10 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Plus d'actions"
                title="Plus d'actions"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <MoreVertical className="size-3.5" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuItem
              render={
                <a
                  href={`/outils/${tool.slug}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
              disabled={!active}
            >
              <ExternalLink className="size-3.5" />
              Voir la page publique
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDescOpen(true)} disabled={saving}>
              <Pencil className="size-3.5" />
              Éditer la description
            </DropdownMenuItem>
            {showMethodology ? (
              <DropdownMenuItem
                render={
                  <Link
                    href={`/admin/chomage/outils/calculateurs/${tool.slug}`}
                  />
                }
              >
                <BookOpenCheck className="size-3.5" />
                Méthodologie
              </DropdownMenuItem>
            ) : null}
            {configUrl ? (
              <DropdownMenuItem render={<Link href={configUrl} />}>
                <Settings2 className="size-3.5" />
                Configurer
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              disabled={saving}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="size-3.5" />
              Supprimer l&apos;outil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>

      {/* Dialog d'édition de description (hors-tableau) */}
      <Dialog open={descOpen} onOpenChange={setDescOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Description — {tool.name}
            </DialogTitle>
          </DialogHeader>
          <DescriptionEditor
            value={description}
            onSave={saveDescription}
            onChange={setDescription}
            onCancel={() => {
              setDescription(tool.description);
              setDescOpen(false);
            }}
            disabled={saving}
          />
        </DialogContent>
      </Dialog>
    </TableRow>
  );
}

/* ------------------------------------------------------------------ */
/*  SegmentCell — toggle d'un segment + (partenaire) sous-types         */
/* ------------------------------------------------------------------ */

function SegmentCell({
  segment,
  access,
  onToggle,
  disabled,
}: {
  segment: AudienceId;
  access: AccessRule[];
  onToggle: (next: AccessRule[]) => void;
  disabled?: boolean;
}) {
  const on = hasSegment(access, segment);
  const isPartner = segment === "partenaire";
  const subTypes = selectedPartnerTypes(access);

  return (
    <TableCell className="text-center">
      <div className="flex items-center justify-center gap-1">
        <Switch
          checked={on}
          onCheckedChange={() => onToggle(toggleSegment(access, segment))}
          disabled={disabled}
          aria-label={`${on ? "Retirer" : "Donner"} l'accès ${SEGMENT_LABEL[segment]}`}
        />
        {isPartner && on ? (
          <Popover>
            <PopoverTrigger
              disabled={disabled}
              aria-haspopup="dialog"
              title={
                subTypes.length
                  ? `Sous-types : ${subTypes
                      .map((t) => PARTNER_TYPE_LABEL[t])
                      .join(", ")}`
                  : "Tout le segment partenaire — préciser des sous-types"
              }
              aria-label="Sous-types partenaire"
              className="inline-flex size-4 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-50"
            >
              <ChevronDown className="size-3" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[220px] p-2">
              <p className="px-1 pb-1 text-[11px] font-semibold text-foreground">
                Sous-types partenaire
              </p>
              <p className="px-1 pb-1.5 text-[10px] leading-snug text-muted-foreground">
                Aucun coché = tout le segment partenaire.
              </p>
              <div className="flex flex-col gap-0.5">
                {PARTNER_TYPES.map((type: PartnerType) => {
                  const checked = subTypes.includes(type);
                  return (
                    <label
                      key={type}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[12px] hover:bg-accent/60"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() =>
                          onToggle(togglePartnerType(access, type))
                        }
                      />
                      <span>{PARTNER_TYPE_LABEL[type]}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </TableCell>
  );
}

/* ------------------------------------------------------------------ */
/*  IconPickerTile — tuile icône (size-8) qui ouvre le IconPicker       */
/* ------------------------------------------------------------------ */

function IconPickerTile({
  value,
  onChange,
  disabled,
  tone,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  tone: string;
}) {
  const trigger = (
    <button
      type="button"
      disabled={disabled}
      title="Changer l'icône"
      aria-label="Changer l'icône"
      className={cn(
        "group/icon relative flex size-8 shrink-0 items-center justify-center rounded-lg transition",
        tone,
        "hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {value ? (
        <IconDisplay value={value} className="size-4" />
      ) : (
        <Wrench className="size-4 opacity-60" />
      )}
      <Pencil className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded bg-primary p-0.5 text-primary-foreground opacity-0 transition group-hover/icon:opacity-100" />
    </button>
  );
  return <IconPicker value={value} onChange={onChange} trigger={trigger} />;
}

/* ------------------------------------------------------------------ */
/*  EditableInline — click-to-edit pour le titre                       */
/* ------------------------------------------------------------------ */

interface EditableInlineProps {
  value: string;
  onChange: (next: string) => void;
  onSave: (next: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

function EditableInline({
  value,
  onChange,
  onSave,
  placeholder,
  ariaLabel,
  disabled,
  className = "",
}: EditableInlineProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function startEdit() {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (draft !== value) {
      onChange(draft);
      onSave(draft);
    }
  }

  function cancel() {
    setEditing(false);
    setDraft(value);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        maxLength={120}
        className={cn("h-6 px-1 py-0", className)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel ? `${ariaLabel} (clic)` : "Cliquer pour éditer"}
      className={cn(
        "group/edit relative -mx-1 block rounded px-1 text-left transition hover:bg-muted/60 disabled:cursor-not-allowed",
        className,
      )}
    >
      {value || (
        <span className="italic text-muted-foreground/60">
          {placeholder ?? "Cliquer pour éditer"}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  DescriptionEditor — textarea (dans le Dialog)                       */
/* ------------------------------------------------------------------ */

function DescriptionEditor({
  value,
  onSave,
  onChange,
  onCancel,
  disabled,
}: {
  value: string;
  onSave: (next: string) => void;
  onChange: (next: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  function commit() {
    if (draft !== value) {
      onChange(draft);
      onSave(draft);
    } else {
      onCancel();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  }

  return (
    <div>
      <Textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Description publique…"
        aria-label="Éditer la description"
        disabled={disabled}
        maxLength={600}
        rows={4}
        className="min-h-[90px] resize-none text-[12.5px]"
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground/70">
          ⌘+Enter pour valider
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="rounded-md px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={disabled}
            className="rounded-md bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
