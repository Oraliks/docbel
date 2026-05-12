"use client";

import { useState } from "react";
import {
  Loader2Icon,
  SendIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Lang } from "@/lib/documents/types";
import { GLASS_INPUT, GLASS_PRIMARY_STYLE } from "@/lib/glass-classes";

interface AIHelpPopoverProps {
  templateName: string;
  organisme?: string | null;
  fieldId?: string;
  fieldLabel?: string;
  fieldHelp?: string;
  lang: Lang;
}

interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

export function AIHelpPopover({
  templateName,
  organisme,
  fieldId,
  fieldLabel,
  fieldHelp,
  lang,
}: AIHelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setConversation((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documents/ai-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName,
          organisme,
          fieldId,
          fieldLabel,
          fieldHelp,
          question: q,
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur IA");
      setConversation((prev) => [...prev, { role: "assistant", text: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setConversation([]);
    setQuestion("");
    setError(null);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex size-5 items-center justify-center rounded-full text-[color:var(--glass-ink-faint)] transition-colors hover:bg-[color:var(--glass-surface)] hover:text-[color:var(--glass-accent-deep)]"
        title={lang === "nl" ? "AI-hulp" : "Aide IA"}
      >
        <SparklesIcon className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={4}>
        <div
          className="flex items-center justify-between border-b p-3"
          style={{ borderBottomColor: "var(--glass-ink-line)" }}
        >
          <div className="flex items-center gap-2">
            <SparklesIcon
              className="size-4"
              style={{ color: "var(--glass-accent-deep)" }}
            />
            <span className="text-[13px] font-bold text-[color:var(--glass-ink)]">
              {lang === "nl" ? "AI-hulp" : "Aide IA"}
            </span>
          </div>
          {conversation.length > 0 ? (
            <button
              onClick={reset}
              className="text-[11.5px] text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
            >
              {lang === "nl" ? "Wissen" : "Effacer"}
            </button>
          ) : null}
        </div>

        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto p-3">
          {fieldLabel ? (
            <div className="text-[11.5px] text-[color:var(--glass-ink-soft)]">
              {lang === "nl" ? "Vraag over " : "Question sur "}
              <span className="font-semibold text-[color:var(--glass-ink)]">
                « {fieldLabel} »
              </span>
            </div>
          ) : null}

          {conversation.length === 0 ? (
            <div className="flex flex-col gap-1.5 text-[12px] text-[color:var(--glass-ink-soft)]">
              <p>
                {lang === "nl"
                  ? "Stel een vraag over dit veld of dit document."
                  : "Posez une question sur ce champ ou ce document."}
              </p>
              <p className="italic">
                {lang === "nl"
                  ? "Bijv. : « Wat is het verschil tussen netto en bruto? »"
                  : "Ex : « Quelle différence entre brut et net ? »"}
              </p>
            </div>
          ) : null}

          {conversation.map((turn, idx) => (
            <div
              key={idx}
              className="rounded-2xl p-3 text-[13px]"
              style={{
                background:
                  turn.role === "user"
                    ? "rgba(159, 124, 255, 0.14)"
                    : "var(--glass-surface)",
                marginLeft: turn.role === "user" ? "1.5rem" : 0,
                marginRight: turn.role === "user" ? 0 : "1.5rem",
              }}
            >
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
                {turn.role === "user"
                  ? lang === "nl"
                    ? "U"
                    : "Vous"
                  : "IA"}
              </div>
              <div
                className="whitespace-pre-wrap text-[color:var(--glass-ink)]"
                dangerouslySetInnerHTML={{
                  __html: turn.text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
                }}
              />
            </div>
          ))}

          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-[color:var(--glass-ink-soft)]">
              <Loader2Icon className="size-4 animate-spin" />
              {lang === "nl" ? "Aan het denken…" : "Réflexion…"}
            </div>
          ) : null}

          {error ? (
            <div
              className="rounded-2xl p-2 text-[12px]"
              style={{
                background: "rgba(220, 80, 100, 0.12)",
                color: "#b8324a",
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div
          className="flex gap-2 border-t p-2"
          style={{ borderTopColor: "var(--glass-ink-line)" }}
        >
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              lang === "nl" ? "Stel uw vraag…" : "Posez votre question…"
            }
            rows={2}
            maxLength={500}
            className={`${GLASS_INPUT} min-h-0 text-[13px]`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            disabled={loading}
          />
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              size="sm"
              onClick={ask}
              disabled={loading || !question.trim()}
              className="rounded-full"
              style={GLASS_PRIMARY_STYLE}
            >
              <SendIcon className="size-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="rounded-full text-[color:var(--glass-ink-soft)] hover:bg-[color:var(--glass-surface)]"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>

        <div className="px-3 pb-2 text-[10px] text-[color:var(--glass-ink-faint)]">
          {lang === "nl"
            ? "AI kan fouten maken. Controleer belangrijke informatie."
            : "L'IA peut se tromper. Vérifiez les informations importantes."}
        </div>
      </PopoverContent>
    </Popover>
  );
}
