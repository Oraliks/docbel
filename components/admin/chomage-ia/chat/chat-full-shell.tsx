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
import { SnippetsSheet, type SnippetItem } from "./snippets-sheet";
import type { PaletteSnippet } from "./snippet-command-palette";
import { UploadQuickDialog } from "../sources/upload-quick-dialog";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { SessionModelPicker } from "./session-model-picker";
import { openChatStream } from "./sse-client";
import type {
  ChatMessageItem,
  ChatModelValue,
  ChatSessionItem,
  CitedSourceLite,
} from "./types";

interface ChatFullShellProps {
  domain: string;
  aiAvailable: boolean;
  /** Toggle voice input (admin setting + OPENAI_API_KEY). Faux par défaut. */
  voiceAvailable?: boolean;
  enabledSourcesCount: number;
}

export function ChatFullShell({
  domain,
  aiAvailable,
  voiceAvailable = false,
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
  // Affiche les sessions archivées dans le rail (par défaut masquées).
  // Le rail filtre côté UI ; la liste serveur renvoie toutes les non-archivées.
  const [showArchived, setShowArchived] = useState(false);
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
  const [snippetsSheetOpen, setSnippetsSheetOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // ----- Snippets disponibles (chargés une fois + revalidés à chaque mutation) -----
  const [snippets, setSnippets] = useState<PaletteSnippet[]>([]);
  const refreshSnippets = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/chomage-ia/snippets?domain=${encodeURIComponent(domain)}`,
      );
      if (!res.ok) return; // silencieux : pas de toast (chargement de fond)
      const data = (await res.json()) as { items: SnippetItem[] };
      setSnippets(
        data.items.map((s) => ({
          id: s.id,
          shortcut: s.shortcut,
          title: s.title,
          content: s.content,
          domain: s.domain,
          order: s.order,
        })),
      );
    } catch {
      // silencieux — le palette s'affichera avec liste vide.
    }
  }, [domain]);

  useEffect(() => {
    refreshSnippets();
  }, [refreshSnippets]);

  // ----- Migration 21 : Folders KB pour le ScopeSelector -----
  const [folders, setFolders] = useState<
    import("@/lib/chomage-ia/types").KnowledgeFolderListItem[]
  >([]);
  const refreshFolders = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/chomage-ia/kb-folders?domain=${encodeURIComponent(domain)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: import("@/lib/chomage-ia/types").KnowledgeFolderListItem[];
      };
      setFolders(data.items);
    } catch {
      // silencieux — le scope selector affichera juste "Toutes les sources".
    }
  }, [domain]);
  useEffect(() => {
    refreshFolders();
  }, [refreshFolders]);

  // ----- Pour revalider l'historique prompts après une nouvelle génération -----
  const [promptsRevalidateKey, setPromptsRevalidateKey] = useState(0);

  // ----- Edit mode d'un message user dans le thread -----
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // ----- Ref vers l'input principal pour les shortcuts Ctrl+Enter -----
  // (l'input bar gère son propre submit, on n'a pas besoin de ref direct).

  const threadRef = useRef<HTMLDivElement>(null);

  // ----- AbortController pour le bouton Stop pendant un stream SSE -----
  // Tient l'AbortController du fetch streaming courant ; null si rien en cours.
  // Activé pendant `sending=true`, le bouton Stop appelle `abort()` qui interrompt
  // la lecture du ReadableStream → la bulle pending se finalise en "interrompue".
  const abortControllerRef = useRef<AbortController | null>(null);

  function abortCurrentStream() {
    const ctrl = abortControllerRef.current;
    if (ctrl) {
      ctrl.abort();
      abortControllerRef.current = null;
    }
  }

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

  /**
   * Migration 18 — change le modèle Claude associé à une session.
   * `null` → reset au défaut serveur (Sonnet 4.5).
   */
  async function changeSessionModel(
    id: string,
    model: ChatModelValue | null,
  ) {
    // Optimiste : mute la liste locale d'abord pour un feedback instantané.
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, preferredModel: model } : s)),
    );
    try {
      const res = await fetch(`/api/chomage-ia/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredModel: model }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const labelMap: Record<string, string> = {
        "claude-sonnet-4-5-20250929": "Sonnet 4.5 (qualité)",
        "claude-haiku-4-5-20251001": "Haiku 4.5 (rapide)",
      };
      const label = model ? labelMap[model] ?? model : "défaut (auto)";
      toast.success(`Modèle changé : ${label}`);
      refreshSessions();
    } catch (e) {
      // Rollback optimiste en cas d'erreur.
      refreshSessions();
      toast.error("Échec du changement de modèle", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Migration 21 — change le scope folder de la session. [] = toute la KB.
   * Si pas de session active → on stocke localement pour appliquer à la
   * prochaine session créée (mais pour MVP on no-op, le scope est par session).
   */
  async function changeSessionScope(nextScope: string[]) {
    if (!currentSessionId) {
      // Pas de session active — on accepte le changement local pour quand
      // la prochaine session sera créée (le state est gardé via useState
      // dans le shell, mais la persistence DB attend une session).
      // Pour MVP : ignore silencieusement (l'user verra le scope se réinitialiser
      // sur la nouvelle session — pattern naturel).
      return;
    }
    // Optimiste : update local
    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId ? { ...s, scopeFolderIds: nextScope } : s,
      ),
    );
    try {
      const res = await fetch(`/api/chomage-ia/sessions/${currentSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeFolderIds: nextScope }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      // Rollback
      refreshSessions();
      toast.error("Échec du changement de scope", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Migration 17 — toggle pinned. Le tri par `pinned DESC` côté serveur fera
   * remonter automatiquement la session en haut du rail au prochain refresh.
   */
  async function toggleSessionPin(id: string) {
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    const nextPinned = !target.pinned;
    // Optimiste : flip le flag localement (le rail re-trie via le rendu).
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, pinned: nextPinned } : s)),
    );
    try {
      const res = await fetch(`/api/chomage-ia/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: nextPinned }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success(
        nextPinned ? "Conversation épinglée" : "Conversation désépinglée",
      );
      refreshSessions();
    } catch (e) {
      refreshSessions();
      toast.error("Échec de l'épinglage", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Migration 17 — toggle archived. Une session archivée disparaît du rail
   * (sauf si `showArchived=true`). On bascule sans confirmation : l'archive
   * est réversible via le même menu (l'item se grise et le rail garde la
   * session si "Afficher archives" est ON).
   */
  async function toggleSessionArchive(id: string) {
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    const nextArchived = !target.archived;
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, archived: nextArchived } : s)),
    );
    try {
      const res = await fetch(`/api/chomage-ia/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: nextArchived }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success(
        nextArchived
          ? "Conversation archivée"
          : "Conversation restaurée",
      );
      // Si on archive la session courante, on revient à un état "nouvelle conv".
      if (nextArchived && currentSessionId === id) {
        newSession();
      }
      refreshSessions();
    } catch (e) {
      refreshSessions();
      toast.error("Échec de l'archivage", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Duplique une session via POST `/api/chomage-ia/sessions/[id]/duplicate`
   * (endpoint existant — vague 1D) puis ouvre la copie créée.
   */
  async function duplicateSession(id: string) {
    try {
      const res = await fetch(`/api/chomage-ia/sessions/${id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { id: string; title: string };
      toast.success("Conversation dupliquée", { description: data.title });
      await refreshSessions();
      // Ouvre la nouvelle session pour que l'admin voie le résultat.
      openSession(data.id);
    } catch (e) {
      toast.error("Échec de la duplication", {
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

  // ----- Send chat message (mode streaming SSE) -----
  // Le backend supporte aussi le mode JSON legacy ; on demande TOUJOURS du SSE
  // ici via le header `Accept: text/event-stream` posé par openChatStream.
  // En cas de fail-soft (clé Anthropic manquante), le helper yield un event
  // `json_fallback` qu'on traite comme la réponse legacy d'un coup.
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
      content: "",
      citedSourceIds: [],
      pending: true,
      streaming: true,
      pendingStartedAt: startedAt,
      createdAt: new Date().toISOString(),
      kind: "chat",
    };
    setMessages((prev) => [...prev, userMsg, pendingAssistant]);
    setSending(true);
    scrollThreadToBottom();

    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;
    let firstDeltaReceived = false;
    let aborted = false;

    /** Patch le dernier message (la bulle assistant pending) via un updater. */
    function patchLastAssistant(
      updater: (msg: ChatMessageItem) => ChatMessageItem,
    ) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant" && (last.pending || last.streaming)) {
          next[next.length - 1] = updater(last);
        }
        return next;
      });
    }

    try {
      for await (const ev of openChatStream({
        url: "/api/chomage-ia/chat",
        body: {
          sessionId: currentSessionId ?? undefined,
          message: text,
          domain,
        },
        signal: ctrl.signal,
      })) {
        if (ev.type === "text_delta") {
          if (!firstDeltaReceived) {
            firstDeltaReceived = true;
            // Dès le 1er token, on retire le `pending` pour que le rendu
            // markdown remplace le `PendingIndicator`. Le `streaming` reste
            // true tant que `meta`/`done` n'est pas arrivé.
            patchLastAssistant((m) => ({
              ...m,
              pending: false,
              content: m.content + ev.text,
            }));
          } else {
            patchLastAssistant((m) => ({
              ...m,
              content: m.content + ev.text,
            }));
          }
          // Petit autoscroll pendant le stream — pas trop agressif pour
          // ne pas casser le scroll manuel de l'utilisateur.
          scrollThreadToBottom();
        } else if (ev.type === "meta") {
          // Capture sessionId / messageId / citedSources / missingSources.
          if (ev.sessionId && ev.sessionId !== currentSessionId) {
            setCurrentSessionId(ev.sessionId);
            refreshSessions();
          }
          if (Array.isArray(ev.citedSources)) {
            setCitedSources((prev) => {
              const map = new Map<string, CitedSourceLite>();
              for (const s of prev) map.set(s.id, s);
              for (const s of ev.citedSources) map.set(s.id, s);
              return [...map.values()];
            });
          }
          if (Array.isArray(ev.missingSources)) {
            setMissingSources(ev.missingSources);
          } else {
            setMissingSources([]);
          }
          const elapsedMs = Date.now() - startedAt;
          patchLastAssistant((m) => ({
            ...m,
            id: ev.messageId,
            citedSourceIds: ev.citedSourceIds ?? [],
            createdAt: ev.createdAt ?? m.createdAt,
            model: ev.usage?.model ?? null,
            tokensIn: ev.usage?.inputTokens ?? null,
            tokensOut: ev.usage?.outputTokens ?? null,
            elapsedMs,
          }));
        } else if (ev.type === "done") {
          patchLastAssistant((m) => ({
            ...m,
            pending: false,
            streaming: false,
          }));
        } else if (ev.type === "error") {
          patchLastAssistant((m) => ({
            ...m,
            pending: false,
            streaming: false,
            content: m.content
              ? `${m.content}\n\n⚠️ ${ev.message}`
              : `⚠️ ${ev.message}`,
          }));
          toast.error("Erreur côté serveur", { description: ev.message });
        } else if (ev.type === "json_fallback") {
          // Cas du fail-soft "ANTHROPIC_API_KEY manquante" (le backend renvoie
          // du JSON même si on a demandé du SSE).
          const data = ev.payload as {
            message?: { content?: string };
            aiDisabled?: boolean;
            error?: string;
          } | null;
          const fallbackContent =
            data?.message?.content ?? data?.error ?? "Réponse indisponible.";
          patchLastAssistant((m) => ({
            ...m,
            pending: false,
            streaming: false,
            content: fallbackContent,
          }));
          if (data?.aiDisabled) {
            toast.warning("IA non configurée — réponse simulée");
          }
        }
      }
      if (isFirstMessageOfNewSession) {
        // Auto-titre Haiku en background côté serveur → re-fetch ~4s plus tard.
        setTimeout(() => refreshSessions(), 4000);
      }
    } catch (e) {
      // AbortError = bouton Stop — gestion dédiée plus bas.
      if (e instanceof DOMException && e.name === "AbortError") {
        aborted = true;
      } else {
        const errMsg = e instanceof Error ? e.message : String(e);
        patchLastAssistant((m) => ({
          ...m,
          pending: false,
          streaming: false,
          content: m.content
            ? `${m.content}\n\n⚠️ ${errMsg}`
            : `⚠️ ${errMsg}\n\nRéessaie ou vérifie la console serveur.`,
        }));
        toast.error("Échec de la requête", { description: errMsg });
      }
    } finally {
      if (aborted) {
        // L'utilisateur a cliqué Stop. On garde le contenu partiel et on
        // marque la bulle comme "interrompue". Le composant MessageBubble
        // affiche un bouton "Régénérer la réponse" prominent sous la bulle
        // qui relance Claude depuis le même message user en amont via
        // `regenerateFromAssistant`.
        patchLastAssistant((m) => ({
          ...m,
          pending: false,
          streaming: false,
          aborted: true,
          content: m.content
            ? `${m.content}\n\n— *Réponse interrompue par l'utilisateur.*`
            : "— *Réponse interrompue avant le premier token.*",
        }));
        toast("Réponse interrompue", {
          description: "Le streaming a été arrêté.",
        });
      }
      abortControllerRef.current = null;
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
    // contenu, et ajoute une bulle pending (en mode streaming dès le départ).
    setMessages((prev) => {
      const next = prev.slice(0, messageIndex);
      next.push({
        ...targetMessage,
        content: trimmed,
        createdAt: new Date().toISOString(),
      });
      next.push({
        role: "assistant",
        content: "",
        citedSourceIds: [],
        pending: true,
        streaming: true,
        pendingStartedAt: startedAt,
        createdAt: new Date().toISOString(),
        kind: "chat",
      });
      return next;
    });
    setEditingIndex(null);
    setSending(true);
    scrollThreadToBottom();

    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;
    let firstDeltaReceived = false;
    let aborted = false;

    function patchLastAssistant(
      updater: (msg: ChatMessageItem) => ChatMessageItem,
    ) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant" && (last.pending || last.streaming)) {
          next[next.length - 1] = updater(last);
        }
        return next;
      });
    }

    try {
      for await (const ev of openChatStream({
        url: `/api/chomage-ia/sessions/${currentSessionId}/regenerate-from`,
        body: {
          messageIndex: serverIndex,
          newContent: trimmed,
        },
        signal: ctrl.signal,
      })) {
        if (ev.type === "text_delta") {
          if (!firstDeltaReceived) {
            firstDeltaReceived = true;
            patchLastAssistant((m) => ({
              ...m,
              pending: false,
              content: m.content + ev.text,
            }));
          } else {
            patchLastAssistant((m) => ({
              ...m,
              content: m.content + ev.text,
            }));
          }
          scrollThreadToBottom();
        } else if (ev.type === "meta") {
          if (Array.isArray(ev.citedSources)) {
            setCitedSources((prev) => {
              const map = new Map<string, CitedSourceLite>();
              for (const s of prev) map.set(s.id, s);
              for (const s of ev.citedSources) map.set(s.id, s);
              return [...map.values()];
            });
          }
          if (Array.isArray(ev.missingSources)) {
            setMissingSources(ev.missingSources);
          } else {
            setMissingSources([]);
          }
          const elapsedMs = Date.now() - startedAt;
          patchLastAssistant((m) => ({
            ...m,
            id: ev.messageId,
            citedSourceIds: ev.citedSourceIds ?? [],
            createdAt: ev.createdAt ?? m.createdAt,
            model: ev.usage?.model ?? null,
            tokensIn: ev.usage?.inputTokens ?? null,
            tokensOut: ev.usage?.outputTokens ?? null,
            elapsedMs,
          }));
        } else if (ev.type === "done") {
          patchLastAssistant((m) => ({
            ...m,
            pending: false,
            streaming: false,
          }));
        } else if (ev.type === "error") {
          patchLastAssistant((m) => ({
            ...m,
            pending: false,
            streaming: false,
            content: m.content
              ? `${m.content}\n\n⚠️ ${ev.message}`
              : `⚠️ ${ev.message}`,
          }));
          toast.error("Erreur côté serveur", { description: ev.message });
        } else if (ev.type === "json_fallback") {
          const data = ev.payload as {
            message?: { content?: string };
            error?: string;
          } | null;
          const fallbackContent =
            data?.message?.content ?? data?.error ?? "Réponse indisponible.";
          patchLastAssistant((m) => ({
            ...m,
            pending: false,
            streaming: false,
            content: fallbackContent,
          }));
        }
      }
      refreshSessions();
      if (!aborted) {
        toast.success("Message édité et réponse régénérée");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        aborted = true;
      } else {
        const errMsg = e instanceof Error ? e.message : String(e);
        patchLastAssistant((m) => ({
          ...m,
          pending: false,
          streaming: false,
          content:
            "⚠️ Échec de la régénération : " + errMsg,
        }));
        toast.error("Échec de la régénération", { description: errMsg });
      }
    } finally {
      if (aborted) {
        patchLastAssistant((m) => ({
          ...m,
          pending: false,
          streaming: false,
          aborted: true,
          content: m.content
            ? `${m.content}\n\n— *Réponse interrompue par l'utilisateur.*`
            : "— *Réponse interrompue avant le premier token.*",
        }));
        toast("Réponse interrompue", {
          description: "Le streaming a été arrêté.",
        });
      }
      abortControllerRef.current = null;
      setSending(false);
      scrollThreadToBottom();
    }
  }

  // ----- Export session → markdown -----
  async function exportSessionAsMarkdown(id: string) {
    const session = sessions.find((s) => s.id === id);
    const fallbackName = `conversation-${id.slice(0, 8)}.md`;
    try {
      const res = await fetch(`/api/chomage-ia/sessions/${id}/export`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      // Récupère le filename depuis le header Content-Disposition si présent,
      // sinon utilise le titre de la session, sinon le fallback id-tronqué.
      const dispo = res.headers.get("Content-Disposition") || "";
      const m = dispo.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      const filename = m
        ? decodeURIComponent(m[1])
        : session?.title
          ? session.title.replace(/[<>:"/\\|?*]/g, "-").slice(0, 80) + ".md"
          : fallbackName;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Conversation exportée", {
        description: filename,
      });
    } catch (e) {
      toast.error("Échec de l'export", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ----- Supprimer un message individuel (DELETE /messages/[id]) -----
  /**
   * Supprime un ChatMessage côté serveur + le retire du thread localement.
   * Le filtre côté UI utilise l'id du message comme clé (pas l'index, car
   * les bulles `generated_prompt` côté client peuvent décaler les positions).
   */
  async function deleteMessage(messageId: string) {
    // Snapshot pour rollback en cas d'échec, puis update optimiste.
    const snapshot = messages;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      const res = await fetch(`/api/chomage-ia/messages/${messageId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Message supprimé");
      // Re-fetch les sessions pour mettre à jour le messageCount du rail.
      refreshSessions();
    } catch (e) {
      // Rollback si l'API a échoué.
      setMessages(snapshot);
      toast.error("Échec de la suppression", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ----- Régénérer une réponse assistant (depuis le bouton inline ou le menu) -----
  /**
   * Régénère la réponse à partir du dernier message user qui précède le message
   * assistant ciblé. Réutilise la mécanique `editAndRegenerate` avec le même
   * contenu (relance Claude depuis le même prompt, sans modification).
   *
   * Use case principal : bouton "Régénérer" sur une bulle aborted (Stop), ou
   * sur n'importe quelle bulle assistant via le ContextMenu.
   *
   * Si `assistantMessageId` est vide, on cible le DERNIER message assistant
   * du thread (cas aborted avant le 1er token quand l'id n'est pas encore
   * arrivé via l'event meta).
   */
  function regenerateFromAssistant(assistantMessageId: string) {
    if (sending) return;
    let assistantIdx = -1;
    if (assistantMessageId) {
      assistantIdx = messages.findIndex(
        (m) => m.id === assistantMessageId && m.role === "assistant",
      );
    }
    // Fallback : pas d'id → on cherche le dernier message assistant non-prompt.
    if (assistantIdx === -1) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (
          messages[i].role === "assistant" &&
          messages[i].kind !== "generated_prompt"
        ) {
          assistantIdx = i;
          break;
        }
      }
    }
    if (assistantIdx === -1) {
      toast.error("Message introuvable");
      return;
    }
    // Cherche le dernier message user AVANT cette réponse assistant.
    let userIdx = -1;
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === "user" && messages[i].kind !== "generated_prompt") {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) {
      toast.error("Aucun message utilisateur à régénérer en amont");
      return;
    }
    const userContent = messages[userIdx].content;
    // Délègue à editAndRegenerate avec le MÊME contenu user → Claude relance
    // depuis ce point exact avec le même prompt.
    editAndRegenerate(userIdx, userContent);
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
    if (snippetsSheetOpen) {
      setSnippetsSheetOpen(false);
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
  }, [
    sourcesSheetOpen,
    promptsSheetOpen,
    snippetsSheetOpen,
    uploadOpen,
    editingIndex,
  ]);

  // ----- Rendu -----
  const currentSession = currentSessionId
    ? sessions.find((s) => s.id === currentSessionId)
    : null;
  const currentTitle = currentSession?.title ?? "Nouvelle conversation";

  // Filtre les archivées dans le rail si le toggle n'est pas activé.
  // Si une session est à la fois `pinned` ET `archived` : on l'affiche QUAND
  // showArchived=true. L'épinglage prime sur l'ordre (pinned en haut), mais
  // pas sur la visibilité — l'archive masque toujours quand showArchived=false.
  const displayedSessions = showArchived
    ? sessions
    : sessions.filter((s) => !s.archived);
  const archivedCount = sessions.filter((s) => s.archived).length;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Rail gauche */}
      <SessionsRail
        sessions={displayedSessions}
        loading={loadingSessions}
        currentId={currentSessionId}
        onSelect={openSession}
        onNew={newSession}
        onDelete={deleteSession}
        onRename={renameSession}
        onOpenPrompts={() => setPromptsSheetOpen(true)}
        onChangeModel={changeSessionModel}
        onOpenSnippets={() => setSnippetsSheetOpen(true)}
        onExportMarkdown={exportSessionAsMarkdown}
        onTogglePin={toggleSessionPin}
        onArchive={toggleSessionArchive}
        onDuplicate={duplicateSession}
        showArchived={showArchived}
        onToggleShowArchived={() => setShowArchived((v) => !v)}
        archivedCount={archivedCount}
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
          {/* Sélecteur de modèle Claude pour la session courante (migration 18).
              Visible seulement si on a une session active — sinon le sélecteur
              n'aurait rien à patcher. Pour une nouvelle conv non-persistée,
              l'admin peut switcher dès le 1er envoi qui crée la session. */}
          {currentSessionId ? (
            <div className="ml-2 hidden items-center md:inline-flex">
              <SessionModelPicker
                value={currentSession?.preferredModel ?? null}
                onChange={(m) => changeSessionModel(currentSessionId, m)}
                variant="inline"
                disabled={sending}
                stopPropagation={false}
              />
            </div>
          ) : null}
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
            onDeleteMessage={deleteMessage}
            onRegenerateMessage={regenerateFromAssistant}
            // onForkFromMessage : endpoint /fork pas encore implémenté → reste no-op
            // (le ContextMenu affiche le toast "bientôt dispo" par défaut).
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
            voiceAvailable={voiceAvailable}
            onSendChat={sendChatMessage}
            onGeneratePrompt={generatePrompt}
            onOpenUpload={() => setUploadOpen(true)}
            onStop={abortCurrentStream}
            snippets={snippets}
            onOpenSnippetsManage={() => setSnippetsSheetOpen(true)}
            folders={folders}
            scopeFolderIds={currentSession?.scopeFolderIds ?? []}
            onScopeChange={
              currentSessionId ? changeSessionScope : undefined
            }
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
      <SnippetsSheet
        open={snippetsSheetOpen}
        onOpenChange={setSnippetsSheetOpen}
        domain={domain}
        onSnippetsChange={refreshSnippets}
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
