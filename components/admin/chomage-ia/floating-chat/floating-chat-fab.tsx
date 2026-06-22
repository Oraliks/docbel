"use client";

/**
 * FAB (Floating Action Button) du mini-chat IA, monté globalement dans le
 * layout admin pour être accessible depuis n'importe quelle page /admin/*.
 *
 * Comportement :
 *   - Bouton circulaire violet en bas à droite (fixed bottom-4 right-4 z-40).
 *   - Click → ouvre une Sheet (panel latéral droit ~420px) avec le mini-chat.
 *   - Ferme via Esc, clic backdrop ou bouton X.
 *   - Le state des messages est in-memory : reset à chaque fermeture (mini-chat
 *     volontairement jetable, cf. décision UX "Pas de sessions persistantes").
 *   - Réutilise /api/chomage-ia/quick-chat stateless (RAG + memory comme le
 *     chat complet, mais pas de ChatSession DB).
 *
 * Pas de toggle settings — toujours visible pour l'admin connecté. Si
 * ANTHROPIC_API_KEY manque côté serveur, le 1er envoi yield un message neutre
 * via fail-soft (pas de crash).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquarePlus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { openChatStream } from "../chat/sse-client";
import { MiniThread, type MiniMessage } from "./mini-thread";
import { MiniInputBar } from "./mini-input-bar";

export function FloatingChatFab() {
  const t = useTranslations("admin.chomageIa");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MiniMessage[]>([]);
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Reset complet du fil quand le sheet se ferme (mini-chat jetable).
  useEffect(() => {
    if (!open) {
      // Cancel un éventuel stream en cours si on ferme pendant la réponse.
      abortRef.current?.abort();
      abortRef.current = null;
      // Délai léger pour éviter le flash visuel pendant l'anim de fermeture.
      const t = setTimeout(() => {
        setMessages([]);
        setSending(false);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      threadEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  }, []);

  async function handleSend(
    text: string,
    options?: { attachPage?: boolean },
  ) {
    if (!text.trim() || sending) return;

    // Si le toggle "Joindre la page" est ON, on extrait l'URL + le titre +
    // un résumé court du DOM principal et on le préfixe au message envoyé
    // à Claude. Le user voit son message tel quel (sans préambule technique).
    const pageContext = options?.attachPage ? capturePageContext() : null;
    const claudeMessage = pageContext
      ? `[Contexte page actuelle]\nURL : ${pageContext.url}\nTitre : ${pageContext.title}\n\nExtrait :\n${pageContext.excerpt}\n\n---\n\n${text}`
      : text;

    const userMsg: MiniMessage = {
      role: "user",
      content: pageContext
        ? `${text}\n\n${t("pageAttachedSuffix", { url: pageContext.url })}`
        : text,
      createdAt: Date.now(),
    };
    const pendingMsg: MiniMessage = {
      role: "assistant",
      content: "",
      pending: true,
      streaming: true,
      createdAt: Date.now(),
    };

    // Snapshot pour la requête (les 6 derniers messages).
    const historySnapshot = [...messages, userMsg].slice(-7).slice(0, -1);

    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setSending(true);
    scrollToBottom();

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let firstDelta = false;

    function patchLast(updater: (m: MiniMessage) => MiniMessage) {
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
        url: "/api/chomage-ia/quick-chat",
        body: {
          message: claudeMessage,
          history: historySnapshot.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
        signal: ctrl.signal,
      })) {
        if (ev.type === "text_delta") {
          if (!firstDelta) {
            firstDelta = true;
            patchLast((m) => ({
              ...m,
              pending: false,
              content: m.content + ev.text,
            }));
          } else {
            patchLast((m) => ({ ...m, content: m.content + ev.text }));
          }
          scrollToBottom();
        } else if (ev.type === "meta") {
          patchLast((m) => ({
            ...m,
            citedSources:
              "citedSources" in ev && Array.isArray(ev.citedSources)
                ? (ev.citedSources as MiniMessage["citedSources"])
                : m.citedSources,
          }));
        } else if (ev.type === "done") {
          patchLast((m) => ({ ...m, pending: false, streaming: false }));
        } else if (ev.type === "error") {
          patchLast((m) => ({
            ...m,
            pending: false,
            streaming: false,
            content: m.content
              ? `${m.content}\n\n⚠️ ${ev.message}`
              : `⚠️ ${ev.message}`,
          }));
        } else if (ev.type === "json_fallback") {
          const data = ev.payload as {
            message?: { content?: string };
            aiDisabled?: boolean;
          } | null;
          patchLast((m) => ({
            ...m,
            pending: false,
            streaming: false,
            content: data?.message?.content ?? t("answerUnavailable"),
          }));
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        patchLast((m) => ({
          ...m,
          pending: false,
          streaming: false,
          content: m.content + `\n\n${t("interruptedShort")}`,
        }));
      } else {
        patchLast((m) => ({
          ...m,
          pending: false,
          streaming: false,
          content: `⚠️ ${err instanceof Error ? err.message : t("unknownError")}`,
        }));
      }
    } finally {
      abortRef.current = null;
      setSending(false);
      scrollToBottom();
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("openAssistant")}
        title={t("assistantTitleShortcut")}
        className={cn(
          "fixed bottom-4 right-4 z-40 inline-flex size-12 items-center justify-center rounded-full",
          "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg",
          "transition-all duration-200 hover:scale-105 hover:shadow-xl",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          open && "scale-90 opacity-60 pointer-events-none"
        )}
      >
        <Sparkles className="size-5" />
      </button>

      {/* Sheet panel droit */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full max-w-[420px] flex-col gap-0 p-0 sm:max-w-[420px]"
        >
          {/* Header */}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card/60 px-3">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12.5px] font-bold leading-tight">
                {t("assistantTitle")}
              </span>
              <span className="truncate text-[10.5px] text-muted-foreground leading-tight">
                {messages.length === 0
                  ? t("miniChatSubtitle")
                  : t("questionCount", {
                      count: messages.filter((m) => m.role === "user").length,
                    })}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              title={t("closeEsc")}
            >
              <X className="size-3.5" />
            </Button>
          </header>

          {/* Empty state */}
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
              <MessageSquarePlus className="size-8 opacity-40" />
              <p className="text-[12.5px] font-medium">
                {t("miniEmptyTitle")}
              </p>
              <p className="text-[10.5px]">
                {t("miniEmptyDesc")}
              </p>
            </div>
          ) : (
            <MiniThread messages={messages} threadEndRef={threadEndRef} />
          )}

          {/* Input bar */}
          <div className="shrink-0 border-t border-border bg-card/40 p-2">
            <MiniInputBar
              disabled={false}
              sending={sending}
              onSend={handleSend}
              onStop={handleStop}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * Capture l'URL + titre + un extrait textuel de la page actuelle pour
 * l'envoyer en contexte à Claude. Extrait :
 *   - URL pathname + search (sans le hostname pour rester compact)
 *   - document.title
 *   - texte du `<main>` ou `[role="main"]` ou `body`, tronqué à 6000 chars
 *
 * On nettoie les chunks de whitespace pour économiser des tokens. Volontairement
 * client-side simple : pas de scraping serveur ni de fetch — l'admin voit
 * la page, le DOM est déjà chargé, on l'extrait localement.
 */
function capturePageContext(): {
  url: string;
  title: string;
  excerpt: string;
} | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  const url = window.location.pathname + window.location.search;
  const title = document.title || "Sans titre";

  // On cherche le contenu "principal" pour éviter sidebar / nav / footer.
  const root =
    document.querySelector("main") ??
    document.querySelector('[role="main"]') ??
    document.body;

  // innerText respecte le rendering CSS (display:none ignoré) — mieux que
  // textContent qui inclut les éléments cachés.
  const raw = (root as HTMLElement).innerText ?? "";
  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/(\S{120})/g, "$1 ") // casse les URLs/tokens monstre pour le wrap
    .trim()
    .slice(0, 6000);

  return { url, title, excerpt: cleaned };
}
