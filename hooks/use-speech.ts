"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";

type SpeechStatus = "idle" | "preparing" | "speaking" | "unavailable" | "error";
type SpeechSnapshot = { owner: string | null; status: SpeechStatus };
const IDLE: SpeechSnapshot = { owner: null, status: "idle" };

/** One reading at a time, shared by the public, explicitly supplied text buttons. */
export function createSpeechController(
  getEngine: () => SpeechSynthesis | undefined = () => {
    return typeof window !== "undefined" && "speechSynthesis" in window
      ? window.speechSynthesis
      : undefined;
  },
  createUtterance: (text: string) => SpeechSynthesisUtterance = (text) =>
    new SpeechSynthesisUtterance(text),
) {
  let snapshot = IDLE;
  let revision = 0;
  let engine: SpeechSynthesis | undefined;
  let cleanup = () => {};
  const listeners = new Set<() => void>();
  const publish = (value: SpeechSnapshot) => {
    snapshot = value;
    listeners.forEach((listener) => listener());
  };
  const cancel = () => {
    revision += 1;
    cleanup();
    cleanup = () => {};
    engine?.cancel();
  };
  const stop = (owner: string) => {
    if (snapshot.owner !== owner) return;
    cancel();
    publish(IDLE);
  };
  const speak = (owner: string, text: string, locale: string) => {
    cancel();
    const currentRevision = revision;
    engine = getEngine();
    if (!engine || !text.trim()) {
      publish({ owner, status: "unavailable" });
      return;
    }
    const synthesis = engine;
    publish({ owner, status: "preparing" });
    let timeout: ReturnType<typeof setTimeout>;
    let started = false;
    const finish = (status: SpeechStatus) => {
      if (currentRevision !== revision) return;
      cleanup();
      publish(status === "idle" ? IDLE : { owner, status });
    };
    const ready = () => {
      if (currentRevision !== revision || started) return;
      const voices = synthesis.getVoices();
      const normalized = locale.toLowerCase().replaceAll("_", "-");
      const voice = voices.find((item) => item.lang.toLowerCase() === normalized)
        ?? voices.find((item) => item.lang.toLowerCase().split("-")[0] === normalized.split("-")[0]);
      if (!voice) return;
      started = true;
      cleanup();
      try {
        const utterance = createUtterance(text);
        utterance.lang = voice.lang;
        utterance.voice = voice;
        utterance.rate = 0.9;
        utterance.onstart = () => {
          if (currentRevision !== revision) return;
          clearTimeout(timeout);
          publish({ owner, status: "speaking" });
        };
        utterance.onend = () => finish("idle");
        utterance.onerror = () => finish("error");
        timeout = setTimeout(() => {
          if (currentRevision !== revision) return;
          cancel();
          publish({ owner, status: "error" });
        }, 5000);
        cleanup = () => clearTimeout(timeout);
        synthesis.speak(utterance);
      } catch {
        finish("error");
      }
    };
    timeout = setTimeout(() => finish("unavailable"), 2000);
    synthesis.addEventListener("voiceschanged", ready);
    cleanup = () => {
      clearTimeout(timeout);
      synthesis.removeEventListener("voiceschanged", ready);
    };
    ready();
  };
  return {
    speak,
    stop,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => IDLE,
  };
}

const speech = createSpeechController();

export function useSpeech(text: string, localeOverride?: string) {
  const owner = useId();
  const uiLocale = useLocale();
  const locale = localeOverride ?? uiLocale;
  const pathname = usePathname();
  const snapshot = useSyncExternalStore(speech.subscribe, speech.getSnapshot, speech.getServerSnapshot);
  useEffect(() => {
    const stop = () => speech.stop(owner);
    window.addEventListener("pagehide", stop);
    window.addEventListener("popstate", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("popstate", stop);
      stop();
    };
  }, [owner, pathname, locale, uiLocale, text]);
  return {
    status: snapshot.owner === owner ? snapshot.status : "idle",
    start: () => speech.speak(owner, text, locale),
    stop: () => speech.stop(owner),
  };
}
