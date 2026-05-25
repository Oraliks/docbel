"use client";

/**
 * Shell principal du chat IA pleine page.
 *
 * Layout horizontal :
 *   ┌──────┬─────────────────────────────────┬─────────┐
 *   │ Rail │           Thread + Input         │ Sources │
 *   │ 48px │                                  │ (drawer)│
 *   └──────┴─────────────────────────────────┴─────────┘
 *
 * Gère :
 *   - le state des sessions / messages / sources citées
 *   - le mode input bar (chat vs prompt) avec lecture initiale de ?mode=prompt
 *   - l'injection de bulles `kind: "generated_prompt"` dans le thread
 *   - les toggles des drawers (cited sources right, prompts history left)
 *   - le modal upload quick
 *
 * Réutilise les API existantes inchangées :
 *   - /api/chomage-ia/sessions, /api/chomage-ia/chat
 *   - /api/chomage-ia/prompt-builder, /api/chomage-ia/prompts
 *   - /api/chomage-ia/sources/upload
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  Database,
  PanelRightOpen,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionsRail } from "./sessions-rail";
import { MessageList } from "./message-list";
import { ChatInputBar, type InputBarMode } from "./chat-input-bar";
import { CitedSourcesSheet } from "./cited-sources-sheet";
import {
  PromptsHistorySheet,
  type InjectablePrompt,
} from "./prompts-history-sheet";
import { UploadQuickDialog } from "../sources/upload-quick-dialog";
import type {
  ChatMessageItem,
  ChatSessionItem,
  CitedSourceLite,
} from "./types";

interface ChatFullShellProps {
  domain: string;
  aiAvailable: boolean;
  enabledSourcesCount: number;
}

export function ChatFullShell({
  domain,
  aiAvailable,
  enabledSourcesCount,
}: ChatFullShellProps) {
  const searchParams = useSearchParams();

  // ----- State principal -----
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [citedSources, setCitedSources] = useState<CitedSourceLite[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // ----- Mode input bar -----
  const initialMode: InputBarMode =
    searchParams?.get("mode") === "prompt" ? "prompt" : "chat";
  const [mode, setMode] = useState<InputBarMode>(initialMode);

  // ----- Drawers -----
  const [sourcesSheetOpen, setSourcesSheetOpen] = useState(false);
  const [promptsSheetOpen, setPromptsSheetOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // ----- Pour revalider l'historique prompts après une nouvelle génération -----
  const [promptsRevalidateKey, setPromptsRevalidateKey] = useState(0);

  const threadRef = useRef<HTMLDivElement>(null);

  // ----- Sessions: load + helpers -----
  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/chomage-ia/sessions?domain=${encodeURIComponent(domain)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: ChatSessionItem[] };
      setSessions(data.items);
    } catch (e) {
      toast.error("Impossible de charger les conversations", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoadingSessions(false);
    }
  }, [domain]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const openSession = useCallback(async (id: string) => {
    setCurrentSessionId(id);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chomage-ia/sessions/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(
        (data.messages ?? []).map((m: ChatMessageItem) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citedSourceIds: m.citedSourceIds ?? [],
          model: m.model ?? null,
          tokensIn: m.tokensIn ?? null,
          tokensOut: m.tokensOut ?? null,
          createdAt: m.createdAt,
          // Les messages persistés sont toujours du chat normal.
          kind: "chat" as const,
        })),
      );
      setCitedSources(data.citedSources ?? []);
    } catch (e) {
      toast.error("Impossible de charger la conversation", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  function newSession() {
    setCurrentSessionId(null);
    setMessages([]);
    setCitedSources([]);
  }

  async function deleteSession(id: string) {
    if (!confirm("Supprimer définitivement cette conversation ?")) return;
    try {
      const res = await fetch(`/api/chomage-ia/sessions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Conversation supprimée");
      if (currentSessionId === id) newSession();
      refreshSessions();
    } catch (e) {
      toast.error("Échec de la suppression", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function renameSession(id: string, title: string) {
    try {
      const res = await fetch(`/api/chomage-ia/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refreshSessions();
    } catch (e) {
      toast.error("Échec du renommage", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ----- Scroll helper -----
  function scrollThreadToBottom() {
    requestAnimationFrame(() => {
      threadRef.current?.scrollTo({
        top: threadRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }

  // ----- Send chat message -----
  async function sendChatMessage(text: string) {
    if (!text.trim() || sending) return;
    const startedAt = Date.now();
    const userMsg: ChatMessageItem = {
      role: "user",
      content: text,
      citedSourceIds: [],
      createdAt: new Date().toISOString(),
      kind: "chat",
    };
    const pendingAssistant: ChatMessageItem = {
      role: "assistant",
      content: "…",
      citedSourceIds: [],
      pending: true,
      pendingStartedAt: startedAt,
      createdAt: new Date().toISOString(),
      kind: "chat",
    };
    setMessages((prev) => [...prev, userMsg, pendingAssistant]);
    setSending(true);
    scrollThreadToBottom();

    try {
      const res = await fetch("/api/chomage-ia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId ?? undefined,
          message: text,
          domain,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (data.sessionId && data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.sessionId);
        refreshSessions();
      }
      const elapsedMs = Date.now() - startedAt;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.pending) {
          next[next.length - 1] = {
            role: "assistant",
            content: data.message.content,
            citedSourceIds: data.message.citedSourceIds ?? [],
            createdAt: data.message.createdAt,
            id: data.message.id,
            model: data.usage?.model ?? null,
            tokensIn: data.usage?.inputTokens ?? null,
            tokensOut: data.usage?.outputTokens ?? null,
            elapsedMs,
            kind: "chat",
          };
        }
        return next;
      });
      if (Array.isArray(data.citedSources)) {
        setCitedSources((prev) => {
          const map = new Map<string, CitedSourceLite>();
          for (const s of prev) map.set(s.id, s);
          for (const s of data.citedSources as CitedSourceLite[]) map.set(s.id, s);
          return [...map.values()];
        });
      }
      if (data.aiDisabled) {
        toast.warning("IA non configurée — réponse simulée");
      }
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.pending) {
          next[next.length - 1] = {
            role: "assistant",
            content:
              "⚠️ " +
              (e instanceof Error ? e.message : "Erreur inconnue") +
              "\n\nRéessaie ou vérifie la console serveur.",
            citedSourceIds: [],
            createdAt: new Date().toISOString(),
            kind: "chat",
          };
        }
        return next;
      });
      toast.error("Échec de la requête", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSending(false);
      scrollThreadToBottom();
    }
  }

  // ----- Generate prompt (wand mode) -----
  async function generatePrompt(brief: string, contextHint?: string) {
    if (sending) return;
    const startedAt = Date.now();

    // Bulle utilisateur "Brief" pour contextualiser le thread.
    const userMsg: ChatMessageItem = {
      role: "user",
      content: contextHint
        ? `🪄 Brief : ${brief}\n\nContexte technique : ${contextHint}`
        : `🪄 Brief : ${brief}`,
      citedSourceIds: [],
      createdAt: new Date().toISOString(),
      kind: "chat",
    };
    const pendingAssistant: ChatMessageItem = {
      role: "assistant",
      content: "Génération du prompt Claude Code en cours…",
      citedSourceIds: [],
      pending: true,
      pendingStartedAt: startedAt,
      createdAt: new Date().toISOString(),
      kind: "chat",
    };
    setMessages((prev) => [...prev, userMsg, pendingAssistant]);
    setSending(true);
    // Reviens en mode chat dès le début pour ne pas bloquer la zone input.
    setMode("chat");
    scrollThreadToBottom();

    try {
      const res = await fetch("/api/chomage-ia/prompt-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, contextHint, domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      // Charge le détail complet pour avoir `citedSources` enrichies.
      const detailRes = await fetch(`/api/chomage-ia/prompts/${data.id}`);
      const detail = detailRes.ok
        ? ((await detailRes.json()) as InjectablePrompt)
        : null;

      const elapsedMs = Date.now() - startedAt;

      // Remplace la bulle pending par une bulle `generated_prompt`.
      const generatedMsg: ChatMessageItem = {
        id: `gen-${data.id}`,
        role: "assistant",
        content: data.output as string,
        citedSourceIds: (data.citedSourceIds as string[]) ?? [],
        createdAt: data.createdAt,
        model: null,
        tokensIn: data.usage?.inputTokens ?? null,
        tokensOut: data.usage?.outputTokens ?? null,
        elapsedMs,
        kind: "generated_prompt",
        promptId: data.id,
        promptBrief: brief,
        promptTitle: data.title,
      };

      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.pending) {
          next[next.length - 1] = generatedMsg;
        } else {
          next.push(generatedMsg);
        }
        return next;
      });

      // Enrichit citedSources avec les détails du prompt.
      if (detail?.citedSources && detail.citedSources.length > 0) {
        setCitedSources((prev) => {
          const map = new Map<string, CitedSourceLite>();
          for (const s of prev) map.set(s.id, s);
          for (const s of detail.citedSources) map.set(s.id, s);
          return [...map.values()];
        });
      }

      toast.success("Prompt généré et sauvegardé dans l'historique");
      setPromptsRevalidateKey((k) => k + 1);
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.pending) {
          next[next.length - 1] = {
            role: "assistant",
            content:
              "⚠️ Échec de la génération : " +
              (e instanceof Error ? e.message : "Erreur inconnue"),
            citedSourceIds: [],
            createdAt: new Date().toISOString(),
            kind: "chat",
          };
        }
        return next;
      });
      toast.error("Échec de la génération", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSending(false);
      scrollThreadToBottom();
    }
  }

  // ----- Inject un prompt depuis l'historique -----
  function injectPromptFromHistory(prompt: InjectablePrompt) {
    const msg: ChatMessageItem = {
      id: `hist-${prompt.id}-${Date.now()}`,
      role: "assistant",
      content: prompt.output,
      citedSourceIds: prompt.citedSourceIds,
      createdAt: prompt.createdAt,
      kind: "generated_prompt",
      promptId: prompt.id,
      promptBrief: prompt.brief,
      promptTitle: prompt.title,
    };
    setMessages((prev) => [...prev, msg]);
    if (prompt.citedSources.length > 0) {
      setCitedSources((prev) => {
        const map = new Map<string, CitedSourceLite>();
        for (const s of prev) map.set(s.id, s);
        for (const s of prompt.citedSources) map.set(s.id, s);
        return [...map.values()];
      });
    }
    scrollThreadToBottom();
    toast.success("Prompt réaffiché dans la conversation");
  }

  // ----- Rendu -----
  const currentSession = currentSessionId
    ? sessions.find((s) => s.id === currentSessionId)
    : null;
  const currentTitle = currentSession?.title ?? "Nouvelle conversation";

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Rail gauche */}
      <SessionsRail
        sessions={sessions}
        loading={loadingSessions}
        currentId={currentSessionId}
        onSelect={openSession}
        onNew={newSession}
        onDelete={deleteSession}
        onRename={renameSession}
        onOpenPrompts={() => setPromptsSheetOpen(true)}
      />

      {/* Thread + input central */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        {/* Mini-header chat */}
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card/40 px-4">
          <Sparkles className="size-3.5 text-primary shrink-0" />
          <span className="truncate text-[12.5px] font-semibold">
            {currentTitle}
          </span>
          <span className="ml-2 hidden items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex">
            <Database className="size-3" />
            {enabledSourcesCount} source{enabledSourcesCount > 1 ? "s" : ""} active{enabledSourcesCount > 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSourcesSheetOpen(true)}
              title="Voir les sources citées dans cette conversation"
              className="gap-1.5"
            >
              <BookOpen className="size-3.5" />
              <span className="hidden sm:inline">Sources citées</span>
              {citedSources.length > 0 ? (
                <span className="rounded-full bg-primary/20 px-1.5 text-[10.5px] font-bold text-primary tabular-nums">
                  {citedSources.length}
                </span>
              ) : null}
              <PanelRightOpen className="size-3 opacity-60" />
            </Button>
          </div>
        </div>

        {/* Thread scrollable */}
        <div
          ref={threadRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          id="chomage-ia-thread"
          aria-live="polite"
        >
          <MessageList
            messages={messages}
            loading={loadingMessages}
            citedSources={citedSources}
          />
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-border bg-card/40">
          <ChatInputBar
            mode={mode}
            onModeChange={setMode}
            disabled={!aiAvailable || sending}
            sending={sending}
            onSendChat={sendChatMessage}
            onGeneratePrompt={generatePrompt}
            onOpenUpload={() => setUploadOpen(true)}
          />
          {!aiAvailable ? (
            <p className="border-t border-border bg-amber-50/40 px-4 py-1.5 text-[11px] text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
              L&apos;IA est désactivée — l&apos;envoi de messages et la
              génération sont indisponibles.
            </p>
          ) : null}
        </div>
      </div>

      {/* Sheets et modals */}
      <CitedSourcesSheet
        open={sourcesSheetOpen}
        onOpenChange={setSourcesSheetOpen}
        sources={citedSources}
      />
      <PromptsHistorySheet
        open={promptsSheetOpen}
        onOpenChange={setPromptsSheetOpen}
        domain={domain}
        onInject={injectPromptFromHistory}
        revalidateKey={promptsRevalidateKey}
      />
      <UploadQuickDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        domain={domain}
        onSuccess={() => {
          // Pas de refresh KB nécessaire ici (l'utilisateur reverra le nouveau
          // count au prochain reload de la page chat ou via l'écran Sources).
        }}
      />
    </div>
  );
}
