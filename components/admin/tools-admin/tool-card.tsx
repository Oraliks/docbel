"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ExternalLink,
  Settings2,
  Star,
  Clock,
  Trash2,
  BookOpenCheck,
  Pencil,
  MoreVertical,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  IconDisplay,
  IconPicker,
} from "@/components/admin/documents/icon-picker";
import { AUDIENCES, type AudienceId } from "@/lib/audience";
import { cn } from "@/lib/utils";
import type { Tool } from "./types";

/**
 * Labels d'affichage pour le champ `type` (technique) d'un Tool.
 * Conserve la totalité des entrées de l'ancien `tool-card`.
 */
const TYPE_LABEL: Record<string, string> = {
  calc_preavis: "Calc — Préavis",
  calc_agr: "Calc — AGR",
  calc_cp: "Calc — Salaire",
  calc_brut_net: "Calc — Brut/Net",
  calc_pecule: "Calc — Pécule",
  calc_chomage: "Calc — Chômage",
  calc_indemnite: "Calc — Indemnité",
  calc_pension: "Calc — Pension",
  calc_allocs_fam: "Calc — Allocs fam.",
  calc_ipp: "Calc — IPP",
  calc_tarif_social: "Calc — Tarif social",
  calc_km: "Calc — Frais km",
  locator: "Localisateur",
  tutorial: "Tutoriel",
  info: "FAQ",
  links: "Liens",
  form: "Formulaire",
  doc_generator: "Générateur doc",
};

/**
 * Mapping slug → page admin de configuration spécifique. Si une entrée
 * existe, on ajoute "Configurer" au menu kebab.
 */
const CONFIG_URL: Record<string, string> = {
  preavis: "/admin/chomage/preavis",
  bureaux: "/outils/bureaux",
};

/**
 * Couleurs (badge + icône tile) par audience. Aligné sur la sémantique
 * lib/audience.ts mais avec des teintes distinctes pour permettre la
 * lecture visuelle rapide dans la liste.
 *   - citoyen   : bleu  (public, ouvert à tous)
 *   - employeur : violet (métier RH, plus restreint)
 *   - partenaire: ambre (B2B, partenaires institutionnels uniquement)
 */
const AUDIENCE_TONE: Record<
  AudienceId,
  { badge: string; iconBg: string; iconText: string; label: string }
> = {
  citoyen: {
    badge:
      "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
    iconBg: "bg-blue-500/10 dark:bg-blue-500/15",
    iconText: "text-blue-700 dark:text-blue-300",
    label: "Citoyen",
  },
  employeur: {
    badge:
      "bg-violet-500/10 text-violet-700 border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
    iconBg: "bg-violet-500/10 dark:bg-violet-500/15",
    iconText: "text-violet-700 dark:text-violet-300",
    label: "Employeur",
  },
  partenaire: {
    badge:
      "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    iconBg: "bg-amber-500/10 dark:bg-amber-500/15",
    iconText: "text-amber-700 dark:text-amber-300",
    label: "Partenaire",
  },
};

/**
 * Card horizontale compacte d'un outil dans la liste admin /outils.
 *
 * Layout (left to right) :
 *   - Tile icône (size-9, teintée audience) — clique pour ouvrir IconPicker
 *   - Bloc texte : nom (éditable inline) + sub-label (type + durée éventuelle)
 *   - Badges : Populaire (si applicable) + Audience (cliquable → menu)
 *   - Switch on/off (PATCH /api/tools/[slug])
 *   - Bouton lien externe → /outils/[slug] (nouvelle tab)
 *   - Menu kebab : éditer description, méthodologie (si calc_*), config,
 *                  toggle populaire, supprimer
 *
 * Description : affichée en clair sous le bloc texte si non vide, et
 * éditable via le menu kebab pour garder la densité — la majorité des
 * actions courantes (toggle, lien) sont accessibles sans ouvrir le menu.
 */
export function ToolCard({ tool }: { tool: Tool }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [active, setActive] = useState(tool.active);
  const [popular, setPopular] = useState(tool.popular);
  const [name, setName] = useState(tool.name);
  const [description, setDescription] = useState(tool.description);
  const [icon, setIcon] = useState<string | null>(tool.icon ?? null);
  const [audience, setAudience] = useState<AudienceId>(tool.audience);
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);

  /**
   * PATCH générique du Tool. Body partiel — n'envoie que les champs modifiés.
   * UI optimiste pour les toggles : revert visuel en cas d'erreur.
   */
  async function patch(body: {
    active?: boolean;
    popular?: boolean;
    name?: string;
    description?: string;
    icon?: string | null;
    audience?: AudienceId;
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
      setEditingDescription(false);
      return;
    }
    try {
      await patch({ description: trimmed });
      toast.success("Description mise à jour");
      router.refresh();
    } catch {
      setDescription(tool.description);
    } finally {
      setEditingDescription(false);
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

  function toggleActive(next: boolean) {
    setActive(next);
    void patch({ active: next });
    toast.success(next ? `${tool.name} activé` : `${tool.name} désactivé`);
  }

  function togglePopular() {
    const next = !popular;
    setPopular(next);
    void patch({ popular: next });
    toast.success(next ? "Marqué populaire" : "Retiré des populaires");
  }

  async function saveAudience(next: AudienceId) {
    if (next === audience) return;
    const previous = audience;
    setAudience(next);
    try {
      await patch({ audience: next });
      toast.success(`Audience : ${AUDIENCE_TONE[next].label}`);
      router.refresh();
    } catch {
      setAudience(previous);
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

  const tone = AUDIENCE_TONE[audience];
  const configUrl = CONFIG_URL[tool.slug];
  const showMethodology = tool.type.startsWith("calc_");
  const typeLabel = TYPE_LABEL[tool.type] ?? tool.type;

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-all",
        "hover:border-primary/30 hover:shadow-sm",
        active ? "" : "opacity-60",
      )}
    >
      {/* Ligne principale ------------------------------------------------ */}
      <div className="flex items-center gap-3">
        {/* Tile icône (cliquable → IconPicker) */}
        <IconPickerTile
          value={icon}
          onChange={saveIcon}
          disabled={saving}
          iconBg={tone.iconBg}
          iconText={tone.iconText}
        />

        {/* Nom (éditable inline) + sub-label ------------------------- */}
        <div className="min-w-0 flex-1">
          <EditableInline
            value={name}
            onSave={saveName}
            onChange={setName}
            placeholder="Titre de l'outil…"
            ariaLabel="Éditer le titre"
            disabled={saving}
            className="text-[13.5px] font-semibold text-foreground"
          />
          <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            <span>{typeLabel}</span>
            {tool.timeMin ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Clock className="size-2.5" />
                  {tool.timeMin} min
                </span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span className="font-mono">{tool.slug}</span>
          </p>
        </div>

        {/* Badges (populaire + audience) ------------------------------- */}
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          {popular ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              title="Outil marqué comme populaire"
            >
              <Star className="size-2.5 fill-current" />
              Populaire
            </span>
          ) : null}
          <AudiencePicker
            value={audience}
            onChange={saveAudience}
            disabled={saving}
          />
        </div>

        {/* Switch on/off ------------------------------------------------ */}
        <Switch
          checked={active}
          onCheckedChange={toggleActive}
          disabled={saving}
          aria-label={active ? "Désactiver l'outil" : "Activer l'outil"}
          className="shrink-0"
        />

        {/* Lien externe ------------------------------------------------- */}
        <a
          href={`/outils/${tool.slug}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Ouvrir ${tool.name} dans un nouvel onglet`}
          title="Voir la page publique"
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground",
            !active && "pointer-events-none opacity-40",
          )}
        >
          <ExternalLink className="size-3.5" />
        </a>

        {/* Menu kebab --------------------------------------------------- */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Plus d'actions"
                title="Plus d'actions"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <MoreVertical className="size-3.5" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuItem
              onClick={() => setEditingDescription(true)}
              disabled={saving}
            >
              <Pencil className="size-3.5" />
              Éditer la description
            </DropdownMenuItem>
            <DropdownMenuItem onClick={togglePopular} disabled={saving}>
              <Star
                className={cn(
                  "size-3.5",
                  popular && "fill-amber-500 text-amber-500",
                )}
              />
              {popular ? "Retirer des populaires" : "Marquer populaire"}
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
      </div>

      {/* Badges mobiles ------------------------------------------------ */}
      <div className="flex items-center gap-1.5 sm:hidden">
        {popular ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <Star className="size-2.5 fill-current" />
            Populaire
          </span>
        ) : null}
        <AudiencePicker
          value={audience}
          onChange={saveAudience}
          disabled={saving}
        />
      </div>

      {/* Description (lecture seule + édition via menu) --------------- */}
      {editingDescription ? (
        <DescriptionEditor
          value={description}
          onSave={saveDescription}
          onChange={setDescription}
          onCancel={() => {
            setDescription(tool.description);
            setEditingDescription(false);
          }}
          disabled={saving}
        />
      ) : description ? (
        <p
          className="line-clamp-2 pl-12 text-[11.5px] leading-snug text-muted-foreground"
          title={description}
        >
          {description}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setEditingDescription(true)}
          disabled={saving}
          className="pl-12 text-left text-[11.5px] italic text-muted-foreground/50 hover:text-muted-foreground"
        >
          Ajouter une description…
        </button>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  IconPickerTile — bouton tile (size-9) qui ouvre le IconPicker      */
/* ------------------------------------------------------------------ */

function IconPickerTile({
  value,
  onChange,
  disabled,
  iconBg,
  iconText,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  iconBg: string;
  iconText: string;
}) {
  const trigger = (
    <button
      type="button"
      disabled={disabled}
      title="Changer l'icône"
      aria-label="Changer l'icône"
      className={cn(
        "group/icon relative flex size-9 shrink-0 items-center justify-center rounded-lg transition",
        iconBg,
        iconText,
        "hover:ring-2 hover:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
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
/*  AudiencePicker — pill cliquable avec dropdown                      */
/* ------------------------------------------------------------------ */

function AudiencePicker({
  value,
  onChange,
  disabled,
}: {
  value: AudienceId;
  onChange: (next: AudienceId) => void;
  disabled?: boolean;
}) {
  const tone = AUDIENCE_TONE[value];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            title={`Audience : ${tone.label} — clic pour changer.`}
            aria-label={`Audience actuelle : ${tone.label}`}
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition hover:opacity-80 disabled:opacity-50",
              tone.badge,
            )}
          />
        }
      >
        {tone.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        {AUDIENCES.map((aud) => {
          const Icon = aud.Icon;
          const isActive = aud.id === value;
          const audTone = AUDIENCE_TONE[aud.id];
          return (
            <DropdownMenuItem
              key={aud.id}
              onClick={() => onChange(aud.id)}
              className={isActive ? "bg-accent/60 font-semibold" : ""}
            >
              <span
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded",
                  audTone.iconBg,
                  audTone.iconText,
                )}
              >
                <Icon className="size-3" />
              </span>
              <div className="flex flex-col items-start">
                <span className="text-xs">{audTone.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {audienceHint(aud.id)}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function audienceHint(id: AudienceId): string {
  switch (id) {
    case "citoyen":
      return "Visible par tous";
    case "employeur":
      return "Employeur + partenaire";
    case "partenaire":
      return "Partenaire uniquement";
  }
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

  // Focus + select au passage en mode édition. La synchro `value` → `draft`
  // hors-édition est faite à la main dans `startEdit` (pas besoin d'effect :
  // le bouton de lecture affiche `value` directement).
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
        "group/edit relative -mx-1 block w-full truncate rounded px-1 text-left transition hover:bg-muted/60 disabled:cursor-not-allowed",
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
/*  DescriptionEditor — textarea inline pour éditer la description     */
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
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  }

  return (
    <div className="pl-12">
      <Textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder="Description publique…"
        aria-label="Éditer la description"
        disabled={disabled}
        maxLength={600}
        rows={3}
        className="min-h-[60px] resize-none text-[11.5px]"
      />
      <p className="mt-1 text-[10px] text-muted-foreground/70">
        ⌘+Enter pour valider · Échap pour annuler
      </p>
    </div>
  );
}
