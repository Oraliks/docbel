"use client";

/**
 * Formulaire de génération d'un prompt Claude Code.
 *
 * Champs : `brief` (obligatoire, ce que l'utilisateur veut produire) +
 * `contextHint` (optionnel, précisions techniques). Le serveur enrichit
 * automatiquement avec la knowledge base — pas besoin d'y penser ici.
 *
 * Le composant gère seulement le state du form ; la requête est passée
 * via la callback onGenerate, pour que le parent gère le loading global,
 * l'affichage du résultat et le refresh de l'historique.
 */

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PromptFormProps {
  disabled: boolean;
  loading: boolean;
  onGenerate: (brief: string, contextHint?: string) => void | Promise<void>;
}

const EXAMPLES = [
  "Crée un calculateur AGR (allocation de garantie de revenus) pour temps partiels involontaires",
  "Génère un brief pour un outil de simulation activation Forem (ressort wallon)",
  "Construis un assistant de rédaction de C4 chômage avec champs obligatoires",
];

export function PromptForm({ disabled, loading, onGenerate }: PromptFormProps) {
  const [brief, setBrief] = useState("");
  const [hint, setHint] = useState("");
  const trimmed = brief.trim();
  const canSubmit = trimmed.length >= 5 && !disabled && !loading;

  function submit() {
    if (!canSubmit) return;
    onGenerate(trimmed, hint.trim() || undefined);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wand2 className="size-4" />
        </span>
        <div>
          <h2 className="text-[14px] font-semibold leading-tight">
            Nouveau brief Claude Code
          </h2>
          <p className="text-[11.5px] text-muted-foreground">
            Décris ce que tu veux produire. L&apos;IA s&apos;appuiera sur la KB
            chômage pour générer un prompt complet, prêt à coller.
          </p>
        </div>
      </div>

      <label className="mb-2 block text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        Brief <span className="text-destructive">*</span>
      </label>
      <textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value.slice(0, 1000))}
        disabled={disabled || loading}
        rows={4}
        placeholder="Ex : Crée un calculateur AGR pour temps partiels involontaires…"
        className={cn(
          "w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-[13.5px] leading-relaxed shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      />
      <div className="mt-1.5 mb-3 flex items-center justify-between text-[10.5px] text-muted-foreground">
        <span className="opacity-70">Min. 5 caractères · Max. 1 000</span>
        <span className={brief.length > 900 ? "text-amber-600" : "opacity-70"}>
          {brief.length} / 1000
        </span>
      </div>

      <label className="mb-2 block text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        Contexte technique <span className="opacity-60">(optionnel)</span>
      </label>
      <textarea
        value={hint}
        onChange={(e) => setHint(e.target.value.slice(0, 500))}
        disabled={disabled || loading}
        rows={2}
        placeholder="Ex : Réutiliser le pattern Pension (layout 2-col, jspdf, CountryFlag)…"
        className={cn(
          "w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-[12.5px] leading-relaxed shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={disabled || loading}
              onClick={() => setBrief(ex)}
              className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10.5px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              title="Pré-remplir avec cet exemple"
            >
              {ex.slice(0, 38)}{ex.length > 38 ? "…" : ""}
            </button>
          ))}
        </div>
        <Button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Génération…
            </>
          ) : (
            <>
              <Wand2 className="size-4" />
              Générer le prompt
            </>
          )}
        </Button>
      </div>

      {disabled ? (
        <p className="mt-2 text-[11.5px] text-amber-600 dark:text-amber-400">
          L&apos;IA est désactivée — la génération est indisponible.
        </p>
      ) : null}
    </div>
  );
}
