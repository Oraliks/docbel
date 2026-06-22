"use client";

/**
 * Bouton micro standalone pour l'enregistrement vocal + transcription Whisper.
 *
 * - Click 1 : démarre l'enregistrement, icône passe en rouge clignotante avec
 *   un compteur de durée en secondes (badge superposé).
 * - Click 2 : stoppe, POST à /api/chomage-ia/voice/transcribe, et appelle
 *   `onTranscript(text)` quand la transcription arrive.
 * - Pendant la transcription : spinner + tooltip "Transcription…".
 * - Si pas de micro dispo : bouton désactivé avec tooltip explicite.
 *
 * Le bouton gère TOUT le state interne (recording / uploading / error). Le
 * parent se contente de fournir `onTranscript` et `disabled`.
 */

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  useVoiceRecorder,
  VOICE_MAX_BYTES,
} from "@/lib/chomage-ia/voice-input";

interface Props {
  /** Désactive le bouton (ex: IA off, sending en cours). */
  disabled?: boolean;
  /** Callback appelé avec le texte transcrit. */
  onTranscript: (text: string) => void;
}

export function VoiceInputButton({ disabled, onTranscript }: Props) {
  const t = useTranslations("admin.chomageIa");
  const recorder = useVoiceRecorder();
  const [transcribing, setTranscribing] = useState(false);

  const handleStart = useCallback(async () => {
    if (disabled || recorder.isRecording || transcribing) return;
    const err = await recorder.start();
    if (err) {
      toast.error(t("voiceStartError"), {
        description: err,
      });
    }
  }, [disabled, recorder, transcribing, t]);

  const handleStop = useCallback(async () => {
    if (!recorder.isRecording) return;
    const blob = await recorder.stop();
    if (!blob) {
      toast(t("voiceEmpty"));
      return;
    }
    if (blob.size > VOICE_MAX_BYTES) {
      toast.error(t("voiceTooLong"), {
        description: t("voiceTooLongDesc", {
          mb: Math.round(blob.size / 1024 / 1024),
        }),
      });
      return;
    }
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "voice.webm");
      const res = await fetch("/api/chomage-ia/voice/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => null)) as {
        text?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        const msg = data?.error || `HTTP ${res.status}`;
        if (res.status === 503) {
          toast.warning(t("voiceNotConfigured"), {
            description: msg,
          });
        } else if (res.status === 429) {
          toast.warning(t("voiceTooMany"), { description: msg });
        } else {
          toast.error(t("voiceTranscribeError"), { description: msg });
        }
        return;
      }
      const text = (data?.text || "").trim();
      if (!text) {
        toast(t("voiceNoSpeech"), {
          description: t("voiceNoSpeechDesc"),
        });
        return;
      }
      onTranscript(text);
      toast.success(t("voiceInserted"));
    } catch (e) {
      toast.error(t("voiceNetworkError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setTranscribing(false);
    }
  }, [recorder, onTranscript, t]);

  /** Toggle handler — démarre OU stoppe selon l'état courant. */
  const handleClick = useCallback(() => {
    if (recorder.isRecording) {
      void handleStop();
    } else {
      void handleStart();
    }
  }, [recorder.isRecording, handleStart, handleStop]);

  // Si MediaRecorder pas dispo (Safari ancien / SSR initial) : bouton inactif.
  if (!recorder.isSupported) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled
              aria-label={t("micUnsupported")}
              className="size-9 shrink-0 rounded-xl opacity-60"
            />
          }
        >
          <MicOff className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="top">
          {t("micUnsupported")}
        </TooltipContent>
      </Tooltip>
    );
  }

  const buttonTitle = transcribing
    ? t("voiceTranscribing")
    : recorder.isRecording
      ? t("voiceStopRecording", { sec: recorder.durationSec })
      : t("voiceRecord");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant={recorder.isRecording ? "destructive" : "ghost"}
            size="icon"
            disabled={disabled || transcribing}
            onClick={handleClick}
            aria-label={buttonTitle}
            className={cn(
              "size-9 shrink-0 rounded-xl relative",
              recorder.isRecording && "animate-pulse"
            )}
          />
        }
      >
        {transcribing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : recorder.isRecording ? (
          <Square className="size-3.5 fill-current" />
        ) : (
          <Mic className="size-4" />
        )}
        {recorder.isRecording ? (
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 rounded-full bg-destructive px-1 py-px text-[8.5px] font-bold tabular-nums text-white shadow"
          >
            {recorder.durationSec}s
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent side="top">{buttonTitle}</TooltipContent>
    </Tooltip>
  );
}
