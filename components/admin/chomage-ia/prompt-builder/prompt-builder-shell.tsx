"use client";

/**
 * Shell du générateur de prompts Claude Code.
 *
 * Layout 3 colonnes desktop, empilé mobile :
 *   - Gauche  : formulaire de brief
 *   - Centre  : output du dernier prompt (ou sélectionné dans l'historique)
 *   - Droite  : historique
 *
 * Tous les états (loading, current, items, sending) sont gérés ici.
 * Les sous-composants restent purement présentationnels.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PromptForm } from "./prompt-form";
import { PromptOutput } from "./prompt-output";
import { PromptHistory } from "./prompt-history";
import type { GeneratedPromptFull, PromptHistoryItem } from "./types";

interface PromptBuilderShellProps {
  domain: string;
  aiAvailable: boolean;
}

export function PromptBuilderShell({
  domain,
  aiAvailable,
}: PromptBuilderShellProps) {
  const [items, setItems] = useState<PromptHistoryItem[]>([]);
  const [current, setCurrent] = useState<GeneratedPromptFull | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [generating, setGenerating] = useState(false);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/chomage-ia/prompts?domain=${encodeURIComponent(domain)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: PromptHistoryItem[] };
      setItems(data.items);
    } catch (e) {
      toast.error("Impossible de charger l'historique", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoadingHistory(false);
    }
  }, [domain]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const openPrompt = useCallback(async (id: string) => {
    setLoadingCurrent(true);
    try {
      const res = await fetch(`/api/chomage-ia/prompts/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GeneratedPromptFull;
      setCurrent(data);
    } catch (e) {
      toast.error("Impossible de charger ce prompt", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoadingCurrent(false);
    }
  }, []);

  async function deletePrompt(id: string) {
    try {
      const res = await fetch(`/api/chomage-ia/prompts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Prompt supprimé");
      if (current?.id === id) setCurrent(null);
      refreshHistory();
    } catch (e) {
      toast.error("Échec de la suppression", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function generate(brief: string, contextHint?: string) {
    if (!aiAvailable) {
      toast.error("L'IA est désactivée — impossible de générer.");
      return;
    }
    setGenerating(true);
    setLoadingCurrent(true);
    setCurrent(null);
    try {
      const res = await fetch("/api/chomage-ia/prompt-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, contextHint, domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      // Recharge le détail complet pour avoir les `citedSources` enrichies.
      await openPrompt(data.id);
      refreshHistory();
      toast.success("Prompt généré");
    } catch (e) {
      toast.error("Échec de la génération", {
        description: e instanceof Error ? e.message : String(e),
      });
      setLoadingCurrent(false);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(240px,0.7fr)]">
      <div className="flex flex-col">
        <PromptForm
          disabled={!aiAvailable}
          loading={generating}
          onGenerate={generate}
        />
      </div>
      <div className="min-h-[480px]">
        <PromptOutput
          prompt={current}
          loading={loadingCurrent}
          onDelete={deletePrompt}
        />
      </div>
      <div className="min-h-[480px]">
        <PromptHistory
          items={items}
          currentId={current?.id ?? null}
          loading={loadingHistory}
          onSelect={openPrompt}
          onDelete={deletePrompt}
        />
      </div>
    </div>
  );
}
