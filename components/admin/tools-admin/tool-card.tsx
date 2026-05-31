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
  Users,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  IconDisplay,
  IconPicker,
} from "@/components/admin/documents/icon-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AUDIENCES, type AudienceId } from "@/lib/audience";
import {
  PARTNER_TYPES,
  parseAccessRules,
  type AccessRule,
  type PartnerType,
} from "@/lib/entitlements";
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
 * Libellés FR des sous-types partenaire (cf. lib/entitlements.ts → PARTNER_TYPES).
 * Aucun sous-type coché = tout le segment partenaire.
 */
const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  onem: "ONEM",
  organisme_paiement: "Organisme de paiement",
  service_public: "Service public",
  prive_asbl: "Privé-ASBL",
};

/**
 * Ordre d'affichage des segments dans l'éditeur d'accès (citoyen → partenaire),
 * aligné sur la hiérarchie historique de lib/audience.ts.
 */
const SEGMENTS: readonly AudienceId[] = ["citoyen", "employeur", "partenaire"];

/**
 * Résumé textuel court d'un AccessRule[] pour le pill de l'éditeur.
 * Ex : "Citoyen", "Employeur + Partenaire", "Partenaire (ONEM, Service public)".
 */
function summarizeAccess(rules: AccessRule[]): string {
  if (rules.length === 0) return "Hérité (audience)";
  const parts: string[] = [];
  for (const segment of SEGMENTS) {
    const segmentRules = rules.filter((r) => r.segment === segment);
    if (segmentRules.length === 0) continue;
    const label = AUDIENCE_TONE[segment].label;
    if (segment === "partenaire") {
      const types = segmentRules
        .map((r) => r.partnerType)
        .filter((t): t is PartnerType => Boolean(t));
      if (types.length > 0) {
        parts.push(
          `${label} (${types.map((t) => PARTNER_TYPE_LABEL[t]).join(", ")})`,
        );
        continue;
      }
    }
    parts.push(label);
  }
  return parts.join(" + ") || "Hérité (audience)";
}

/**
 * Card horizontale compacte d'un outil dans la liste admin /outils.
 *
 * Layout (left to right) :
 *   - Tile icône (size-9, teintée audience) — clique pour ouvrir IconPicker
 *   - Bloc texte : nom (éditable inline) + sub-label (type + durée éventuelle)
 *   - Badges : Populaire (si applicable) + Accès set-based (popover segments /
 *              sous-types partenaire) + Audience legacy (cliquable → menu).
 *              L'accès set-based prime ; l'audience reste le fallback quand
 *              l'accès est vide (cf. lib/entitlements.ts → effectiveRules).
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
  // Set-based access. `tool.access` peut être brut/undefined (cf. types.ts) →
  // on le normalise en AccessRule[] via le même parseur que le serveur.
  const [access, setAccess] = useState<AccessRule[]>(() =>
    parseAccessRules(tool.access),
  );
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

  async function saveAccess(next: AccessRule[]) {
    const previous = access;
    setAccess(next);
    try {
      await patch({ access: next });
      toast.success(
        next.length === 0
          ? "Accès réinitialisé (hérite de l'audience)"
          : `Accès : ${summarizeAccess(next)}`,
      );
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

        {/* Badges (populaire + accès + audience) ----------------------- */}
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
          <AccessPicker value={access} onChange={saveAccess} disabled={saving} />
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
      <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
        {popular ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <Star className="size-2.5 fill-current" />
            Populaire
          </span>
        ) : null}
        <AccessPicker value={access} onChange={saveAccess} disabled={saving} />
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
/*  AccessPicker — éditeur du modèle d'accès set-based (AccessRule[])  */
/* ------------------------------------------------------------------ */

/** Sous-types partenaire sélectionnés (non-null) dans un AccessRule[]. */
function selectedPartnerTypes(rules: AccessRule[]): PartnerType[] {
  return rules
    .filter((r) => r.segment === "partenaire" && r.partnerType)
    .map((r) => r.partnerType as PartnerType);
}

/** Ajoute/retire un segment "simple" (citoyen / employeur) sans toucher au reste. */
function toggleSimpleSegment(
  rules: AccessRule[],
  segment: Extract<AudienceId, "citoyen" | "employeur">,
): AccessRule[] {
  const present = rules.some((r) => r.segment === segment);
  if (present) return rules.filter((r) => r.segment !== segment);
  return [...rules, { segment }];
}

/**
 * Active/désactive tout le segment partenaire. On = règle "tout le segment"
 * ({ segment: "partenaire" } sans partnerType). Off = retire toute règle
 * partenaire (sous-types inclus).
 */
function togglePartnerSegment(rules: AccessRule[]): AccessRule[] {
  const present = rules.some((r) => r.segment === "partenaire");
  const others = rules.filter((r) => r.segment !== "partenaire");
  if (present) return others;
  return [...others, { segment: "partenaire" }];
}

/**
 * Active/désactive un sous-type partenaire. Cocher un premier sous-type
 * remplace la règle "tout le segment" par des règles ciblées ; décocher le
 * dernier sous-type retombe sur "tout le segment".
 */
function togglePartnerType(
  rules: AccessRule[],
  type: PartnerType,
): AccessRule[] {
  const others = rules.filter((r) => r.segment !== "partenaire");
  const current = selectedPartnerTypes(rules);
  const next = current.includes(type)
    ? current.filter((t) => t !== type)
    : [...current, type];
  if (next.length === 0) {
    // Plus aucun sous-type : tout le segment partenaire.
    return [...others, { segment: "partenaire" }];
  }
  return [
    ...others,
    ...next.map((t) => ({ segment: "partenaire" as const, partnerType: t })),
  ];
}

/**
 * Pill + popover pour éditer l'accès set-based d'un outil. Cohabite avec
 * l'AudiencePicker legacy (qui sert de fallback quand l'accès est vide).
 */
function AccessPicker({
  value,
  onChange,
  disabled,
}: {
  value: AccessRule[];
  onChange: (next: AccessRule[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const summary = summarizeAccess(value);
  const partnerOn = value.some((r) => r.segment === "partenaire");
  const partnerTypes = selectedPartnerTypes(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        title={`Accès (segments) : ${summary} — clic pour modifier.`}
        aria-label={`Accès actuel : ${summary}`}
        className={cn(
          "inline-flex max-w-[200px] items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/80 transition hover:opacity-80 disabled:opacity-50",
        )}
      >
        <Users className="size-2.5 shrink-0" />
        <span className="truncate normal-case">{summary}</span>
        <ChevronDown className="size-2.5 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[260px] p-2">
        <p className="px-1 pb-1 text-[11px] font-semibold text-foreground">
          Accès (segments)
        </p>
        <p className="px-1 pb-2 text-[10px] leading-snug text-muted-foreground">
          Qui peut utiliser cet outil. Aucun segment coché = l&apos;outil
          retombe sur l&apos;audience legacy ci-contre.
        </p>

        <div className="flex flex-col gap-0.5">
          {SEGMENTS.map((segment) => {
            const tone = AUDIENCE_TONE[segment];
            const checked = value.some((r) => r.segment === segment);
            return (
              <label
                key={segment}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-[12px] hover:bg-accent/60"
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => {
                    if (segment === "partenaire") {
                      onChange(togglePartnerSegment(value));
                    } else {
                      onChange(toggleSimpleSegment(value, segment));
                    }
                  }}
                />
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    tone.badge,
                  )}
                >
                  {tone.label}
                </span>
              </label>
            );
          })}
        </div>

        {/* Sous-multiselect des sous-types partenaire (révélé si partenaire coché) */}
        {partnerOn ? (
          <div className="mt-1 border-t border-border pt-2">
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sous-types partenaire
            </p>
            <p className="px-1 pb-1.5 text-[10px] leading-snug text-muted-foreground">
              Aucun coché = tout le segment partenaire.
            </p>
            <div className="flex flex-col gap-0.5">
              {PARTNER_TYPES.map((type) => {
                const checked = partnerTypes.includes(type);
                return (
                  <label
                    key={type}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[12px] hover:bg-accent/60"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() =>
                        onChange(togglePartnerType(value, type))
                      }
                    />
                    <span>{PARTNER_TYPE_LABEL[type]}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        {value.length > 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className="mt-2 w-full rounded-md px-1.5 py-1 text-left text-[10px] text-muted-foreground transition hover:bg-accent/60 hover:text-foreground disabled:opacity-50"
          >
            Réinitialiser (hériter de l&apos;audience)
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
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
