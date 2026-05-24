"use client";

/**
 * Layout 3 zones du chat IA :
 *   - Gauche  : sidebar sessions (repliable)
 *   - Centre  : thread + input bar
 *   - Droite  : panneau des sources citées dans la conversation courante
 *
 * Gère le routing minimal des sessions via state local (pas de slug URL pour
 * l'instant ; navigation via clicks dans la sidebar).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionsSidebar } from "./sessions-sidebar";
import { MessageList } from "./message-list";
import { InputBar } from "./input-bar";
import { CitedSourcesPanel } from "./cited-sources-panel";
import type {
  ChatMessageItem,
  ChatSessionItem,
  CitedSourceLite,
} from "./types";

interface ChatShellProps {
  domain: string;
  aiAvailable: boolean;
  enabledSourcesCount: number;
}

export function ChatShell({
  domain,
  aiAvailable,
  enabledSourcesCount,
}: ChatShellProps) {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [citedSources, setCitedSources] = useState<CitedSourceLite[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const threadRef = useRef<HTMLDivElement>(null);

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/chomage-ia/sessions?domain=${encodeURIComponent(domain)}`
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
        }))
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

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return;
    const startedAt = Date.now();
    const userMsg: ChatMessageItem = {
      role: "user",
      content: text,
      citedSourceIds: [],
      createdAt: new Date().toISOString(),
    };
    const pendingAssistant: ChatMessageItem = {
      role: "assistant",
      content: "…",
      citedSourceIds: [],
      pending: true,
      pendingStartedAt: startedAt,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, pendingAssistant]);
    setSending(true);
    // Scroll to bottom after render
    requestAnimationFrame(() => {
      threadRef.current?.scrollTo({
        top: threadRef.current.scrollHeight,
        behavior: "smooth",
      });
    });

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
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      // Si nouvelle session, on enregistre l'id et on refresh la liste.
      if (data.sessionId && data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.sessionId);
        refreshSessions();
      }
      // Remplace le pending par la vraie réponse.
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
          };
        }
        return next;
      });
      // Merge citedSources (uniques).
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
      // Remplace le pending par un message d'erreur côté UI uniquement.
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
          };
        }
        return next;
      });
      toast.error("Échec de la requête", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSending(false);
      requestAnimationFrame(() => {
        threadRef.current?.scrollTo({
          top: threadRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }

  return (
    <div className="grid h-[70vh] min-h-[520px] grid-cols-1 gap-3 lg:grid-cols-[260px_1fr_280px]">
      {/* Sidebar gauche : sessions */}
      <div
        className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all ${
          leftOpen ? "lg:flex" : "lg:hidden"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Conversations
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setLeftOpen(false)}
            title="Replier"
          >
            <PanelLeftClose className="size-3.5" />
          </Button>
        </div>
        <SessionsSidebar
          sessions={sessions}
          loading={loadingSessions}
          currentId={currentSessionId}
          onSelect={openSession}
          onNew={newSession}
          onDelete={deleteSession}
          onRename={renameSession}
        />
      </div>

      {/* Thread central */}
      <div className="flex min-w-0 flex-col rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-1">
            {!leftOpen ? (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setLeftOpen(true)}
                title="Voir les conversations"
              >
                <PanelLeftOpen className="size-3.5" />
              </Button>
            ) : null}
            <span className="text-[12.5px] font-semibold">
              {currentSessionId
                ? sessions.find((s) => s.id === currentSessionId)?.title ??
                  "Conversation"
                : "Nouvelle conversation"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              {enabledSourcesCount} source{enabledSourcesCount > 1 ? "s" : ""}{" "}
              en KB
            </span>
            {!rightOpen ? (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setRightOpen(true)}
                title="Afficher les sources citées"
              >
                <PanelRightOpen className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
        <div
          ref={threadRef}
          className="flex-1 overflow-y-auto px-3 py-4"
          id="chomage-ia-thread"
        >
          <MessageList
            messages={messages}
            loading={loadingMessages}
            citedSources={citedSources}
          />
        </div>
        <div className="border-t border-border bg-background/60 px-3 py-3">
          <InputBar
            disabled={!aiAvailable || sending}
            sending={sending}
            onSend={sendMessage}
          />
          {!aiAvailable ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              L&apos;IA est désactivée — voir bandeau ci-dessus.
            </p>
          ) : null}
        </div>
      </div>

      {/* Panneau droite : sources citées */}
      <div
        className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all ${
          rightOpen ? "lg:flex" : "lg:hidden"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Sources citées
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setRightOpen(false)}
            title="Replier"
          >
            <PanelRightClose className="size-3.5" />
          </Button>
        </div>
        <CitedSourcesPanel sources={citedSources} />
      </div>
    </div>
  );
}
