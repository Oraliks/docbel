"use client";

import { useTranslations } from "next-intl";
import { AudioLines, LoaderCircle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeech } from "@/hooks/use-speech";

/** Pass public instructions only; never collect form answers or page DOM text. */
export function SpeechButton({ text, label, className, locale }: {
  text: string;
  label?: string;
  className?: string;
  /** Language of the supplied text, if different from the surrounding UI. */
  locale?: string;
}) {
  const t = useTranslations("public.accessibility");
  const { status, start, stop } = useSpeech(text, locale);
  const active = status === "speaking" || status === "preparing";
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`min-h-11 ${className ?? ""}`}
        onClick={active ? stop : start}
        aria-pressed={status === "speaking"}
        disabled={!text.trim()}
      >
        {status === "preparing" ? <LoaderCircle className="animate-spin" aria-hidden />
          : active ? <Square aria-hidden /> : <AudioLines aria-hidden />}
        {active ? t("stopListening") : label ?? t("listenText")}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">
        {status === "unavailable" ? t("speechUnavailable")
          : status === "error" ? t("speechError")
          : status === "preparing" ? t("speechLoading") : null}
      </span>
    </span>
  );
}
