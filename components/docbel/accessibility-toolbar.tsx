"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  Accessibility,
  AudioLines,
  Contrast,
  Gauge,
  Pause,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAccessibilityPreferencesServerSnapshot,
  getAccessibilityPreferencesSnapshot,
  subscribeAccessibilityPreferences,
  updateAccessibilityPreferences,
  type DocbelTextSize,
} from "@/lib/accessibility-preferences";

const NEXT_TEXT_SIZE: Record<DocbelTextSize, DocbelTextSize> = {
  normal: "large",
  large: "xlarge",
  xlarge: "normal",
};

const TEXT_SIZE_KEYS: Record<
  DocbelTextSize,
  "textSize.normal" | "textSize.large" | "textSize.xlarge"
> = {
  normal: "textSize.normal",
  large: "textSize.large",
  xlarge: "textSize.xlarge",
};

interface AccessibilityToolbarProps {
  showSimpleMode?: boolean;
  showReducedMotion?: boolean;
}

export function AccessibilityToolbar({
  showSimpleMode = true,
  showReducedMotion = true,
}: AccessibilityToolbarProps = {}) {
  const t = useTranslations("public.accessibility");
  const preferences = useSyncExternalStore(
    subscribeAccessibilityPreferences,
    getAccessibilityPreferencesSnapshot,
    getAccessibilityPreferencesServerSnapshot,
  );
  const [speaking, setSpeaking] = useState(false);

  function toggleSpeech() {
    if (!("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const readable = Array.from(
      document.querySelectorAll<HTMLElement>("[data-docbel-readable]"),
    )
      .filter((node) => node.offsetParent !== null)
      .map((node) => node.innerText.trim())
      .filter(Boolean)
      .join(". ");
    if (!readable) return;

    const utterance = new SpeechSynthesisUtterance(readable);
    utterance.lang = document.documentElement.lang || "fr";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <section
      aria-label={t("title")}
      className="glass-surface flex flex-wrap items-center gap-1.5 rounded-2xl p-2"
    >
      <span className="flex min-h-10 items-center gap-1.5 px-1.5 text-xs font-bold text-[color:var(--glass-ink)] sm:text-sm">
        <Accessibility aria-hidden />
        {t("title")}
      </span>
      <Button
        type="button"
        variant={speaking ? "default" : "outline"}
        size="sm"
        className="min-h-10 px-2.5"
        aria-pressed={speaking}
        onClick={toggleSpeech}
      >
        <AudioLines data-icon="inline-start" aria-hidden />
        {speaking ? t("stopListening") : t("listen")}
      </Button>
      <Button
        type="button"
        variant={preferences.textSize === "normal" ? "outline" : "default"}
        size="sm"
        className="min-h-10 px-2.5"
        onClick={() =>
          updateAccessibilityPreferences({
            textSize: NEXT_TEXT_SIZE[preferences.textSize],
          })
        }
      >
        <Type data-icon="inline-start" aria-hidden />
        {t(TEXT_SIZE_KEYS[preferences.textSize])}
      </Button>
      <Button
        type="button"
        variant={preferences.highContrast ? "default" : "outline"}
        size="sm"
        className="min-h-10 px-2.5"
        aria-pressed={preferences.highContrast}
        onClick={() =>
          updateAccessibilityPreferences({
            highContrast: !preferences.highContrast,
          })
        }
      >
        <Contrast data-icon="inline-start" aria-hidden />
        {t("contrast")}
      </Button>
      {showSimpleMode && (
        <Button
          type="button"
          variant={preferences.simpleMode ? "default" : "outline"}
          size="sm"
          className="min-h-10 px-2.5"
          aria-pressed={preferences.simpleMode}
          onClick={() =>
            updateAccessibilityPreferences({ simpleMode: !preferences.simpleMode })
          }
        >
          <Gauge data-icon="inline-start" aria-hidden />
          {t("simpleMode")}
        </Button>
      )}
      {showReducedMotion && (
        <Button
          type="button"
          variant={preferences.reducedMotion ? "default" : "outline"}
          size="sm"
          className="min-h-10 px-2.5"
          aria-pressed={preferences.reducedMotion}
          onClick={() =>
            updateAccessibilityPreferences({
              reducedMotion: !preferences.reducedMotion,
            })
          }
        >
          <Pause data-icon="inline-start" aria-hidden />
          {t("reduceMotion")}
        </Button>
      )}
    </section>
  );
}
