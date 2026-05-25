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
import { MissingSourcesHint } from "./missing-sources-hint";
import {
  PromptsHistorySheet,
  type InjectablePrompt,
} from "./prompts-history-sheet";
import { UploadQuickDialog } from "../sources/upload-quick-dialog";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
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
  // Références légales détectées dans la dernière réponse assistant qui ne
  // sont PAS couvertes par la KB. Sert à afficher la bannière `MissingSourcesHint`.
  // Reset à chaque ouverture / nouvelle session / dismiss user.
  const [missingSources, setMissingSources] = useState<string[]>([]);

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

  // ----- Edit mode d'un message user dans le thread -----
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // ----- Ref vers l'input principal pour les shortcuts Ctrl+Enter -----
  // (l'input bar gère son propre submit, on n'a pas besoin de ref direct).

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
    setMissingSources([]);
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
    setMissingSources([]);
  }

  // La confirmation est maintenant gérée par `SessionsRail` (ConfirmDeleteDialog).
  // Cette fonction est appelée APRÈS validation utilisateur.
  async function deleteSession(id: string) {
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
    const isFirstMessageOfNewSession = currentSessionId === null;
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
      // Auto-titre : pour une nouvelle session, Haiku titre en background côté
      // serveur. Re-fetch la liste après ~4s pour récupérer le nouveau titre.
      if (isFirstMessageOfNewSession) {
        setTimeout(() => {
          refreshSessions();
        }, 4000);
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
      // Refs légales détectées et absentes de la KB (max 3) — la bannière
      // au-dessus de l'input bar invitera l'admin à les uploader.
      if (Array.isArray(data.missingSources)) {
        setMissingSources(data.missingSources as string[]);
      } else {
        setMissingSources([]);
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

  // ----- Edit + regenerate -----
  /**
   * Édite un message user (par index dans `messages[]`) et relance la
   * conversation à partir de ce message. Appelle l'endpoint
   * `/api/chomega-ia/sessions/[id]/regenerate-from` qui supprime tous les
   * messages d'index ≥ idx en DB, persiste le nouveau message user et
   * renvoie la nouvelle réponse assistant.
   *
   * Côté UI : on tronque optimistement le thread, on remplace le user message
   * par sa version éditée, puis on ajoute une bulle pending assistant.
   */
  async function editAndRegenerate(messageIndex: number, newContent: string) {
    const trimmed = newContent.trim();
    if (!trimmed || sending) return;
    if (!currentSessionId) {
      toast.error("Impossible d'éditer : aucune session active");
      return;
    }

    // Calcule l'index réel côté serveur : on ignore les bulles non-persistées
    // (kind="generated_prompt" sont uniquement client-side).
    // En pratique les messages persistés sont en début de tableau et les
    // bulles `generated_prompt` peuvent être intercalées. On compte donc le
    // nombre de messages chat (user/assistant non-prompt) jusqu'à l'index.
    let serverIndex = 0;
    for (let i = 0; i < messageIndex; i++) {
      const m = messages[i];
      if (m.kind !== "generated_prompt") serverIndex++;
    }

    const targetMessage = messages[messageIndex];
    if (!targetMessage || targetMessage.role !== "user") {
      toast.error("Le message à éditer doit être un message utilisateur");
      return;
    }

    const startedAt = Date.now();

    // UI optimiste : tronque tout ce qui suit l'index édité, remplace le
    // contenu, et ajoute une bulle pending.
    setMessages((prev) => {
      const next = prev.slice(0, messageIndex);
      next.push({
        ...targetMessage,
        content: trimmed,
        createdAt: new Date().toISOString(),
      });
      next.push({
        role: "assistant",
        content: "Régénération en cours…",
        citedSourceIds: [],
        pending: true,
        pendingStartedAt: startedAt,
        createdAt: new Date().toISOString(),
        kind: "chat",
      });
      return next;
    });
    setEditingIndex(null);
    setSending(true);
    scrollThreadToBottom();

    try {
      const res = await fetch(
        `/api/chomage-ia/sessions/${currentSessionId}/regenerate-from`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageIndex: serverIndex,
            newContent: trimmed,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const elapsedMs = Date.now() - startedAt;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.pending) {
          next[next.length - 1] = {
            id: data.message.id,
            role: "assistant",
            content: data.message.content,
            citedSourceIds: data.message.citedSourceIds ?? [],
            createdAt: data.message.createdAt,
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
          for (const s of data.citedSources as CitedSourceLite[]) {
            map.set(s.id, s);
          }
          return [...map.values()];
        });
      }
      if (Array.isArray(data.missingSources)) {
        setMissingSources(data.missingSources as string[]);
      } else {
        setMissingSources([]);
      }
      // Refresh la liste sessions pour updatedAt.
      refreshSessions();
      toast.success("Message édité et réponse régénérée");
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.pending) {
          next[next.length - 1] = {
            role: "assistant",
            content:
              "⚠️ Échec de la régénération : " +
              (e instanceof Error ? e.message : "Erreur inconnue"),
            citedSourceIds: [],
            createdAt: new Date().toISOString(),
            kind: "chat",
          };
        }
        return next;
      });
      toast.error("Échec de la régénération", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSending(false);
      scrollThreadToBottom();
    }
  }

  // ----- Shortcut helpers -----
  const toggleMode = useCallback(() => {
    setMode((m) => (m === "chat" ? "prompt" : "chat"));
  }, []);

  const closeDrawers = useCallback(() => {
    let closedSomething = false;
    if (sourcesSheetOpen) {
      setSourcesSheetOpen(false);
      closedSomething = true;
    }
    if (promptsSheetOpen) {
      setPromptsSheetOpen(false);
      closedSomething = true;
    }
    if (uploadOpen) {
      setUploadOpen(false);
      closedSomething = true;
    }
    // Esc en mode édition annule l'édition.
    if (editingIndex !== null && !closedSomething) {
      setEditingIndex(null);
    }
  }, [sourcesSheetOpen, promptsSheetOpen, uploadOpen, editingIndex]);

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
            editingIndex={editingIndex}
            onRequestEdit={(idx) => {
              if (sending) return;
              setEditingIndex(idx);
            }}
            onSubmitEdit={editAndRegenerate}
            onCancelEdit={() => setEditingIndex(null)}
            actionsDisabled={sending}
            onOpenSources={() => setSourcesSheetOpen(true)}
            // TODO(agent-1B / backend): wirer onDeleteMessage, onRegenerateMessage,
            // onForkFromMessage quand les endpoints existent. Pour l'instant le
            // MessageBubble affiche un toast "bientôt disponible".
          />
        </div>

        {/* Bannière "sources manquantes" — apparaît si la dernière réponse IA
            référence des lois/AR absents de la KB. L'admin peut ouvrir
            directement le modal upload pour combler le gap. */}
        {missingSources.length > 0 && !sending ? (
          <div className="shrink-0 border-t border-border bg-background px-4 py-2">
            <MissingSourcesHint
              missingRefs={missingSources}
              onOpenUpload={() => setUploadOpen(true)}
              onDismiss={() => setMissingSources([])}
            />
          </div>
        ) : null}

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

      {/* Raccourcis clavier globaux (composant invisible) */}
      <KeyboardShortcuts
        onNewSession={newSession}
        onToggleMode={toggleMode}
        onCloseDrawers={closeDrawers}
      />
    </div>
  );
}
