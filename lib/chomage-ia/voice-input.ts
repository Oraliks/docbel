/**
 * Helpers et hook React pour le voice input via MediaRecorder + Whisper.
 *
 * Stack :
 *   - `MediaRecorder` natif browser → enregistre l'audio dans un Blob.
 *   - Format choisi : `audio/webm;codecs=opus` (universel sur Chrome / Edge /
 *     Firefox récents). Fallback sur `audio/webm` simple si pas supporté, puis
 *     sur le défaut du navigateur (Safari = `audio/mp4`).
 *   - Le Blob est envoyé en multipart à /api/chomage-ia/voice/transcribe qui
 *     proxy vers Whisper côté serveur (clé OpenAI jamais exposée au client).
 *
 * SSR safe : tous les checks `navigator` sont guardés.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Renvoie true si l'API MediaRecorder + getUserMedia est dispo dans le browser.
 * SSR safe (window/navigator peuvent être undefined).
 */
export function hasMicrophone(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator === "undefined") return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  if (typeof MediaRecorder === "undefined") return false;
  return true;
}

/**
 * Choisit le meilleur mimeType supporté par le browser courant pour l'enregistrement.
 * Renvoie undefined → on laisse `MediaRecorder` choisir son défaut (Safari etc).
 */
function pickAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      // Some browsers throw on isTypeSupported with certain values — skip.
    }
  }
  return undefined;
}

/** Limite client = 25 Mo (Whisper accepte jusqu'à 25 Mo). */
export const VOICE_MAX_BYTES = 25 * 1024 * 1024;

export interface UseVoiceRecorderState {
  /** True pendant l'enregistrement. */
  isRecording: boolean;
  /** Durée en secondes de l'enregistrement courant (mise à jour ~chaque seconde). */
  durationSec: number;
  /** True si MediaRecorder + getUserMedia sont dispo. */
  isSupported: boolean;
  /** Dernière erreur (permission refusée, micro absent, etc). */
  error: string | null;
  /** Démarre l'enregistrement. Renvoie un message d'erreur si l'init a foiré. */
  start: () => Promise<string | null>;
  /** Stoppe et renvoie le Blob audio enregistré (ou null si rien). */
  stop: () => Promise<Blob | null>;
  /** Annule l'enregistrement en cours (libère le micro sans renvoyer de Blob). */
  cancel: () => void;
}

/**
 * Hook React minimaliste pour enregistrer de l'audio depuis le micro browser.
 *
 * Usage :
 *   const rec = useVoiceRecorder();
 *   <button onClick={() => rec.isRecording ? handleStop() : rec.start()}>
 *     {rec.isRecording ? `Stop · ${rec.durationSec}s` : "Record"}
 *   </button>
 *
 *   async function handleStop() {
 *     const blob = await rec.stop();
 *     if (!blob) return;
 *     // POST blob to /api/chomage-ia/voice/transcribe …
 *   }
 */
export function useVoiceRecorder(): UseVoiceRecorderState {
  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);

  // Detect support after mount (hasMicrophone uses navigator/window).
  useEffect(() => {
    setIsSupported(hasMicrophone());
  }, []);

  // Cleanup au démontage.
  useEffect(() => {
    return () => {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const start = useCallback(async (): Promise<string | null> => {
    setError(null);
    if (!hasMicrophone()) {
      const msg = "Micro indisponible sur ce navigateur";
      setError(msg);
      return msg;
    }
    if (isRecording) return null;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      const friendly =
        m.includes("Permission") || m.includes("denied")
          ? "Permission micro refusée"
          : `Impossible d'accéder au micro : ${m}`;
      setError(friendly);
      return friendly;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = pickAudioMimeType();

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const friendly =
        "Format audio non supporté par ce navigateur : " +
        (e instanceof Error ? e.message : String(e));
      setError(friendly);
      return friendly;
    }

    recorderRef.current = recorder;

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunksRef.current.push(ev.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });
      chunksRef.current = [];
      // Libère le micro après le stop.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      recorderRef.current = null;
      setIsRecording(false);
      setDurationSec(0);
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      const resolver = stopResolverRef.current;
      stopResolverRef.current = null;
      if (resolver) resolver(blob);
    };

    recorder.onerror = (ev) => {
      const errEvent = ev as Event & { error?: { message?: string } };
      setError(errEvent.error?.message || "Erreur d'enregistrement");
    };

    // Démarre l'enregistrement.
    try {
      recorder.start();
    } catch (e) {
      const friendly =
        "Impossible de démarrer l'enregistrement : " +
        (e instanceof Error ? e.message : String(e));
      setError(friendly);
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
      return friendly;
    }
    startedAtRef.current = Date.now();
    setIsRecording(true);
    setDurationSec(0);
    tickRef.current = window.setInterval(() => {
      if (startedAtRef.current === null) return;
      setDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return null;
  }, [isRecording]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") {
      return null;
    }
    return new Promise<Blob | null>((resolve) => {
      stopResolverRef.current = resolve;
      try {
        recorderRef.current?.stop();
      } catch {
        // Si stop échoue, résous null.
        resolve(null);
      }
    });
  }, []);

  const cancel = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      // Vide le resolver pour qu'aucun blob ne soit renvoyé même si un .stop()
      // était en flight quelque part.
      stopResolverRef.current = null;
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
    recorderRef.current = null;
    setIsRecording(false);
    setDurationSec(0);
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  return {
    isRecording,
    durationSec,
    isSupported,
    error,
    start,
    stop,
    cancel,
  };
}
