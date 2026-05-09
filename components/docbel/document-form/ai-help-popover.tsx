"use client";

import { useState } from "react";
import { Sparkles, Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Lang } from "@/lib/documents/types";

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
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title={lang === "nl" ? "AI-hulp" : "Aide IA"}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={4}>
        <div className="border-b p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">
              {lang === "nl" ? "AI-hulp" : "Aide IA"}
            </span>
          </div>
          {conversation.length > 0 && (
            <button
              onClick={reset}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {lang === "nl" ? "Wissen" : "Effacer"}
            </button>
          )}
        </div>

        <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
          {fieldLabel && (
            <div className="text-xs text-muted-foreground">
              {lang === "nl" ? "Vraag over " : "Question sur "}
              <span className="font-medium text-foreground">« {fieldLabel} »</span>
            </div>
          )}

          {conversation.length === 0 && (
            <div className="text-xs text-muted-foreground space-y-1.5">
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
          )}

          {conversation.map((turn, idx) => (
            <div
              key={idx}
              className={`text-sm ${
                turn.role === "user"
                  ? "bg-primary/10 ml-6 p-2 rounded-md"
                  : "bg-muted mr-6 p-2 rounded-md"
              }`}
            >
              <div className="text-[10px] uppercase font-medium text-muted-foreground mb-1">
                {turn.role === "user"
                  ? lang === "nl"
                    ? "U"
                    : "Vous"
                  : "IA"}
              </div>
              <div
                className="whitespace-pre-wrap"
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

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {lang === "nl" ? "Aan het denken…" : "Réflexion…"}
            </div>
          )}

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <div className="border-t p-2 flex gap-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={lang === "nl" ? "Stel uw vraag…" : "Posez votre question…"}
            rows={2}
            maxLength={500}
            className="text-sm min-h-0"
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
            >
              <Send className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="px-3 pb-2 text-[10px] text-muted-foreground">
          {lang === "nl"
            ? "AI kan fouten maken. Controleer belangrijke informatie."
            : "L'IA peut se tromper. Vérifiez les informations importantes."}
        </div>
      </PopoverContent>
    </Popover>
  );
}
