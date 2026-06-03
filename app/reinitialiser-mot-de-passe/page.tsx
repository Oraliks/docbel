"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

const FIELD =
  "w-full rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-3 text-[14px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const tokenError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token || tokenError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-8 text-center">
        <span
          className="flex size-12 items-center justify-center rounded-2xl"
          style={{ background: "rgba(220, 80, 100, 0.12)", color: "#b8324a" }}
        >
          <AlertCircleIcon className="size-6" />
        </span>
        <h1 className="glass-display text-[22px] font-semibold">
          Lien invalide ou expiré
        </h1>
        <p className="max-w-sm text-[13.5px] text-[color:var(--glass-ink-soft)]">
          Ce lien de réinitialisation n&apos;est plus valable. Faites une
          nouvelle demande.
        </p>
        <Link
          href="/mot-de-passe-oublie"
          className="mt-1 rounded-full px-5 py-2.5 text-[13px] font-bold"
          style={{ background: "var(--glass-ink)", color: "var(--glass-bg-a)" }}
        >
          Nouvelle demande
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (resetError) {
        setError(
          resetError.message ||
            "Lien invalide ou expiré. Faites une nouvelle demande.",
        );
        return;
      }
      toast.success("Mot de passe réinitialisé. Vous pouvez vous connecter.");
      router.push("/login");
    } catch {
      setError("Une erreur est survenue. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="glass-display text-[32px] font-semibold leading-[1.05]">
          Nouveau mot de passe
        </h1>
        <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
          Choisissez un nouveau mot de passe pour votre compte.
        </p>
      </header>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
            Nouveau mot de passe
          </span>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
            Confirmation
          </span>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            className={FIELD}
          />
        </label>
        {error ? (
          <div
            className="flex items-start gap-2 rounded-2xl p-3 text-[13px]"
            style={{ background: "rgba(220, 80, 100, 0.12)", color: "#b8324a" }}
          >
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--glass-ink)", color: "var(--glass-bg-a)" }}
        >
          {loading ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
          {loading ? "Enregistrement…" : "Réinitialiser le mot de passe"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="glass-root">
      <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
        <Link
          href="/login"
          className="inline-flex w-fit items-center gap-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          <ArrowLeftIcon className="size-4" />
          Retour à la connexion
        </Link>
        <Suspense
          fallback={
            <div className="flex justify-center py-10">
              <LoaderCircleIcon className="size-8 animate-spin text-[color:var(--glass-ink-soft)]" />
            </div>
          }
        >
          <ResetForm />
        </Suspense>
      </section>
    </div>
  );
}
