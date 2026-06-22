"use client";

/**
 * Sélecteur de modèle Claude par session de chat (migration 18).
 *
 * Composant double-usage :
 *   - Mode "badge"  : petit avatar circulaire/pill "S" (Sonnet violet) /
 *                     "H" (Haiku cyan) / "·" (Auto gris) — sert dans le rail
 *                     côté chaque session.
 *   - Mode "inline" : bouton inline plus large avec label "Modèle : Sonnet 4.5"
 *                     pour la zone au-dessus du thread.
 *
 * Click → DropdownMenu Shadcn avec 3 choix : Sonnet / Haiku / Auto (= null).
 * Le callback `onChange(value)` reçoit le `preferredModel` (string ou null).
 *
 * Le composant est non-contrôlé pour l'ouverture du menu (Base UI Menu
 * gère son state interne). Le parent fournit la valeur courante + le
 * callback de mutation (PATCH côté API).
 */

import { useTranslations } from "next-intl";
import { Sparkles, Zap, Wand } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  CHAT_MODEL_OPTIONS,
  findChatModelOption,
  type ChatModelValue,
} from "./types";

interface Props {
  /** Valeur courante (null = défaut auto / Sonnet). */
  value: string | null;
  /** Callback : `null` = reset au défaut. */
  onChange: (value: ChatModelValue | null) => void | Promise<void>;
  /** Variante d'affichage du trigger. */
  variant?: "badge" | "inline";
  /** Empêche tout changement (ex: pendant un stream en cours). */
  disabled?: boolean;
  /**
   * Pour le badge : `onClick` stoppe la propagation pour éviter de
   * sélectionner la session sous-jacente. True par défaut.
   */
  stopPropagation?: boolean;
}

export function SessionModelPicker({
  value,
  onChange,
  variant = "badge",
  disabled = false,
  stopPropagation = true,
}: Props) {
  const t = useTranslations("admin.chomageIa");
  const current = findChatModelOption(value);
  const isAuto = current === null;

  const triggerContent =
    variant === "badge" ? (
      <BadgeTrigger
        short={current?.short ?? "·"}
        badgeClass={
          current?.badgeClass ??
          "bg-muted text-muted-foreground ring-border/60"
        }
        tooltipLabel={
          isAuto
            ? t("modelTooltipDefault")
            : t("modelTooltipChange", { label: current!.label })
        }
        isAuto={isAuto}
        disabled={disabled}
      />
    ) : (
      <InlineTrigger
        label={current?.label ?? "Sonnet 4.5"}
        tagline={isAuto ? t("modelTaglineAuto") : t("modelTaglineForced")}
        badgeClass={
          current?.badgeClass ??
          "bg-muted text-muted-foreground ring-border/60"
        }
        short={current?.short ?? "·"}
        disabled={disabled}
      />
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            aria-label={t("modelAriaLabel")}
            onClick={(e) => {
              if (stopPropagation) e.stopPropagation();
            }}
            className={cn(
              "inline-flex items-center outline-none transition-opacity",
              "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background rounded-full",
              disabled && "cursor-not-allowed opacity-50",
              !disabled && "hover:opacity-80"
            )}
          />
        }
      >
        {triggerContent}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-56"
        // Empêche le clic dans le menu de remonter à la session sous-jacente.
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
        }}
      >
        <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wider">
          {t("modelMenuLabel")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CHAT_MODEL_OPTIONS.map((opt) => {
          const selected = opt.value === value;
          const Icon = opt.value === "claude-haiku-4-5-20251001" ? Zap : Sparkles;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex flex-col items-start gap-0.5",
                selected && "bg-accent/60"
              )}
            >
              <span className="flex w-full items-center gap-1.5 text-[12px] font-semibold">
                <Icon className="size-3.5" />
                {opt.label}
                {selected ? (
                  <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-primary">
                    {t("modelActive")}
                  </span>
                ) : null}
              </span>
              <span className="text-[10.5px] text-muted-foreground">
                {opt.tagline}
              </span>
              <span className="text-[9.5px] tabular-nums text-muted-foreground/80">
                {opt.pricePerMsg}
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onChange(null)}
          className={cn(
            "flex flex-col items-start gap-0.5",
            isAuto && "bg-accent/60"
          )}
        >
          <span className="flex w-full items-center gap-1.5 text-[12px] font-semibold">
            <Wand className="size-3.5" />
            {t("modelDefaultAuto")}
            {isAuto ? (
              <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-primary">
                {t("modelActive")}
              </span>
            ) : null}
          </span>
          <span className="text-[10.5px] text-muted-foreground">
            {t("modelDefaultAutoDesc")}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ */
/*  Triggers internes                                                  */
/* ------------------------------------------------------------------ */

function BadgeTrigger({
  short,
  badgeClass,
  tooltipLabel,
  isAuto,
  disabled,
}: {
  short: string;
  badgeClass: string;
  tooltipLabel: string;
  isAuto: boolean;
  disabled: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "flex size-4 items-center justify-center rounded-full ring-1 text-[8.5px] font-bold tabular-nums leading-none",
              badgeClass,
              isAuto && "opacity-70"
            )}
            aria-hidden="true"
          />
        }
      >
        {short}
      </TooltipTrigger>
      {!disabled ? (
        <TooltipContent side="right" className="max-w-xs">
          {tooltipLabel}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

function InlineTrigger({
  label,
  tagline,
  badgeClass,
  short,
  disabled,
}: {
  label: string;
  tagline: string;
  badgeClass: string;
  short: string;
  disabled: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10.5px] text-muted-foreground shadow-sm transition-colors",
        !disabled && "hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <span
        className={cn(
          "flex size-3.5 items-center justify-center rounded-full ring-1 text-[8px] font-bold tabular-nums leading-none",
          badgeClass
        )}
        aria-hidden="true"
      >
        {short}
      </span>
      <span className="font-semibold text-foreground">{label}</span>
      <span className="opacity-70">· {tagline}</span>
    </span>
  );
}
