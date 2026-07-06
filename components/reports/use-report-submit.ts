"use client";

import { useCallback, useState } from "react";

export type ReportSubmitStatus = "idle" | "submitting" | "done" | "error";

export interface ReportSubmitInput {
  targetId?: string;
  message?: string;
  payload: unknown;
  reporterEmail?: string;
}

export type ReportSubmitResult = { ok: true } | { ok: false; error: string };

/// Logique de soumission partagée par toutes les intégrations de
/// signalement (composant générique + les 5 UIs existantes rebranchées).
/// Un seul endroit qui connaît l'URL /api/reports et la forme du body.
export function useReportSubmit(type: string) {
  const [status, setStatus] = useState<ReportSubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (input: ReportSubmitInput): Promise<ReportSubmitResult> => {
      setStatus("submitting");
      setError(null);
      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, ...input }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          const message = body.error ?? "Échec de l'envoi du signalement.";
          setStatus("error");
          setError(message);
          return { ok: false, error: message };
        }
        setStatus("done");
        return { ok: true };
      } catch {
        const message = "Réseau indisponible. Réessayez.";
        setStatus("error");
        setError(message);
        return { ok: false, error: message };
      }
    },
    [type],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { submit, status, error, reset };
}
