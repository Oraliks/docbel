"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  LoaderCircleIcon,
  MailCheckIcon,
  MailIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

const FIELD =
  "w-full rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] py-3 pr-4 pl-11 text-[14px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]";

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
      <div className="grid min-h-screen w-full lg:grid-cols-[1fr_1.1fr]">
        <aside
          className="relative hidden items-center justify-center overflow-hidden p-10 lg:flex"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 30% 30%, var(--glass-accent-d) 0%, transparent 60%), linear-gradient(135deg, var(--glass-accent-c) 0%, var(--glass-accent-a) 60%, var(--glass-accent-deep) 100%)",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 80% 80%, rgba(255,255,255,0.5) 0%, transparent 40%)",
            }}
          />
          <div className="relative flex flex-col items-center gap-6 text-center text-white">
            <div className="relative">
              <div className="relative flex h-[280px] w-[220px] -rotate-6 flex-col gap-3 rounded-2xl bg-white/95 p-5 shadow-[0_18px_50px_rgba(40,15,80,0.30)]">
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className="text-[10px] font-extrabold tracking-[0.12em]"
                    style={{ color: "var(--glass-accent-a)" }}
                  >
                    DOCBEL
                  </span>
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: "var(--glass-accent-a)" }}
                  >
                    ● ● ●
                  </span>
                </div>
                <div className="h-1.5 w-3/4 rounded-full bg-[rgba(159,124,255,0.20)]" />
                <div className="h-1.5 rounded-full bg-[rgba(159,124,255,0.20)]" />
                <div className="h-1.5 w-1/2 rounded-full bg-[rgba(159,124,255,0.20)]" />
                <div className="h-1.5 rounded-full bg-[rgba(159,124,255,0.20)]" />
                <div className="h-1.5 w-3/4 rounded-full bg-[rgba(159,124,255,0.20)]" />
                <div
                  className="absolute right-3 bottom-3 size-10 rounded-xl"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-c))",
                  }}
                />
              </div>
              <div className="absolute -right-12 top-32 flex w-[140px] flex-col gap-1.5 rotate-[10deg] rounded-xl bg-white/95 p-3 shadow-[0_12px_30px_rgba(40,15,80,0.25)]">
                <div className="h-1 rounded-full bg-[rgba(159,124,255,0.20)]" />
                <div className="h-1 w-1/2 rounded-full bg-[rgba(159,124,255,0.20)]" />
                <div className="h-1 w-3/4 rounded-full bg-[rgba(159,124,255,0.20)]" />
              </div>
            </div>
            <div className="relative max-w-sm">
              <p className="glass-display text-[28px] font-semibold leading-tight">
                Récupérez votre accès,{" "}
                <em className="not-italic text-white/90">en un email.</em>
              </p>
              <p className="mt-3 text-[14px] text-white/80">
                Un lien sécurisé de réinitialisation, valable 1 heure, vous sera
                envoyé.
              </p>
            </div>
          </div>
        </aside>

        <main className="relative flex flex-col p-6 sm:p-10 lg:p-14">
          <Link
            href="/login"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-white/55 dark:hover:bg-white/10"
          >
            <ArrowLeftIcon className="size-4" />
            Retour à la connexion
          </Link>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
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
                <header className="mb-8 flex flex-col gap-2 text-center sm:text-left">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
                    Accès oublié
                  </p>
                  <h1 className="glass-display text-[40px] font-semibold leading-[1.05] sm:text-[48px]">
                    Mot de passe oublié
                  </h1>
                  <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
                    Entrez votre email : nous vous enverrons un lien pour
                    réinitialiser votre mot de passe.
                  </p>
                </header>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
                      Email
                    </span>
                    <div className="relative">
                      <MailIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
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
                    </div>
                  </label>
                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: "var(--glass-ink)",
                      color: "var(--glass-bg-a)",
                    }}
                  >
                    {loading ? (
                      <LoaderCircleIcon className="size-4 animate-spin" />
                    ) : null}
                    {loading ? "Envoi…" : "Envoyer le lien"}
                  </button>
                </form>
                <p className="mt-6 text-center text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  Vous vous souvenez ?{" "}
                  <Link
                    href="/login"
                    className="font-bold text-[color:var(--glass-accent-deep)] hover:underline"
                  >
                    Se connecter
                  </Link>
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
