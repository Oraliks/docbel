"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, LoaderCircleIcon, MailCheckIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const FIELD =
  "w-full rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-3 text-[14px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: "/reinitialiser-mot-de-passe",
      });
    } catch {
      // Volontairement silencieux.
    } finally {
      // Anti-énumération : on affiche toujours le même message de succès,
      // que le compte existe ou non.
      setSent(true);
      setLoading(false);
    }
  };

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

        {sent ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-8 text-center">
            <span
              className="flex size-14 items-center justify-center rounded-2xl text-white"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
              }}
            >
              <MailCheckIcon className="size-6" />
            </span>
            <h1 className="glass-display text-[24px] font-semibold">
              Vérifiez votre boîte mail
            </h1>
            <p className="max-w-sm text-[13.5px] text-[color:var(--glass-ink-soft)]">
              Si un compte existe pour <strong>{email}</strong>, un lien de
              réinitialisation (valable 1 heure) vient d&apos;être envoyé.
            </p>
            <p className="text-[12px] text-[color:var(--glass-ink-faint)]">
              Pas d&apos;email ? Vérifiez vos spams.
            </p>
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-2">
              <h1 className="glass-display text-[32px] font-semibold leading-[1.05]">
                Mot de passe oublié
              </h1>
              <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
                Entrez votre email : nous vous enverrons un lien pour
                réinitialiser votre mot de passe.
              </p>
            </header>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
                  Email
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.be"
                  disabled={loading}
                  className={FIELD}
                />
              </label>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "var(--glass-ink)", color: "var(--glass-bg-a)" }}
              >
                {loading ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : null}
                {loading ? "Envoi…" : "Envoyer le lien"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
