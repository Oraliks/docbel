"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from "lucide-react";

type Status = "idle" | "verifying" | "success" | "error";

interface ConfirmAccountProps {
  token: string | null;
}

export function ConfirmAccount({ token }: ConfirmAccountProps) {
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const [errorMessage, setErrorMessage] = useState<string>(
    token ? "" : "Lien d'activation manquant.",
  );

  useEffect(() => {
    if (!token) return;

    const run = async () => {
      try {
        const res = await fetch("/api/auth/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || "Lien invalide ou expiré.");
          setStatus("error");
          return;
        }
        setStatus("success");
      } catch (err) {
        console.error(err);
        setErrorMessage("Erreur réseau. Réessayez dans un instant.");
        setStatus("error");
      }
    };

    void run();
  }, [token]);

  if (status === "verifying") {
    return (
      <div className="glass-surface flex flex-col items-center gap-4 p-10 text-center">
        <span
          className="flex size-14 items-center justify-center rounded-2xl text-white"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
          }}
        >
          <Loader2Icon className="size-6 animate-spin" />
        </span>
        <h1 className="glass-display text-[24px] font-semibold">
          Activation en cours…
        </h1>
        <p className="max-w-sm text-[13px] text-[color:var(--glass-ink-soft)]">
          Nous vérifions votre lien d&apos;activation. Cela ne prend que
          quelques secondes.
        </p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="glass-surface flex flex-col items-center gap-4 p-10 text-center">
        <span
          className="flex size-14 items-center justify-center rounded-2xl text-white"
          style={{
            backgroundImage: "linear-gradient(135deg, #80E0C0, #40C0A0)",
          }}
        >
          <CheckCircle2Icon className="size-6" />
        </span>
        <h1 className="glass-display text-[28px] font-semibold">
          Compte activé !
        </h1>
        <p className="max-w-md text-[13.5px] text-[color:var(--glass-ink-soft)]">
          Votre adresse email est confirmée. Vous pouvez maintenant vous
          connecter à votre espace partenaire.
        </p>
        <Link
          href="/login"
          className="mt-2 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[13.5px] font-bold transition hover:opacity-90"
          style={{
            background: "var(--glass-ink)",
            color: "var(--glass-bg-a)",
          }}
        >
          Se connecter
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-surface flex flex-col items-center gap-4 p-10 text-center">
      <span
        className="flex size-14 items-center justify-center rounded-2xl text-white"
        style={{
          backgroundImage: "linear-gradient(135deg, #FF8CC0, #E0506A)",
        }}
      >
        <AlertCircleIcon className="size-6" />
      </span>
      <h1 className="glass-display text-[24px] font-semibold">
        Activation impossible
      </h1>
      <p className="max-w-md text-[13.5px] text-[color:var(--glass-ink-soft)]">
        {errorMessage}
      </p>
      <Link
        href="/inscription/partenaire"
        className="mt-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-5 py-2.5 text-[13px] font-semibold text-[color:var(--glass-ink)] transition hover:bg-white/55 dark:hover:bg-white/10"
      >
        Recommencer l&apos;inscription
      </Link>
    </div>
  );
}
