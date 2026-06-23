"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  LockIcon,
  MailIcon,
  UserPlusIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

type AuthT = ReturnType<typeof useTranslations<"public.auth">>;

const AUTH_ERROR_KEYS: Record<string, "errInvalidCredentials" | "errAccountInactive" | "errAccountLocked"> = {
  invalid_credentials: "errInvalidCredentials",
  INVALID_EMAIL_OR_PASSWORD: "errInvalidCredentials",
  account_inactive: "errAccountInactive",
  account_locked: "errAccountLocked",
};

function getAuthErrorMessage(
  t: AuthT,
  error: { code?: string | null; message?: string | null } | null | undefined,
) {
  const key = error?.code || "";
  if (key && AUTH_ERROR_KEYS[key]) return t(AUTH_ERROR_KEYS[key]);
  if (error?.message) return error.message;
  return t("errSignInFailed");
}

/** Destination post-connexion selon le rôle (utilisée s'il n'y a pas de ?next= explicite). */
function destForRole(role: string | null | undefined): string {
  switch (role) {
    case "partner":
      return "/partenaire";
    case "employer":
      return "/employeur";
    case "admin":
    case "moderator":
      return "/admin";
    default:
      return "/";
  }
}

function LoginForm() {
  const t = useTranslations("public.auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitNext = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fieldClass =
    "w-full rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] py-3 pr-4 pl-11 text-[14px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email,
        password,
      });
      if (signInError || !data?.user) {
        const msg = getAuthErrorMessage(t, signInError);
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(t("signInSuccess"));
      const role = (data.user as { role?: string | null }).role ?? null;
      router.push(explicitNext ?? destForRole(role));
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("errUnknown");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: explicitNext ?? "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("errUnknown");
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error ? (
        <div
          className="flex items-start gap-3 rounded-2xl p-3.5 text-[13px]"
          style={{
            background: "rgba(220, 80, 100, 0.12)",
            color: "#b8324a",
          }}
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-bold">{t("errBannerTitle")}</p>
            <p className="opacity-80">{error}</p>
          </div>
        </div>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
          {t("emailLabel")}
        </span>
        <div className="relative">
          <MailIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            disabled={loading}
            className={fieldClass}
          />
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
          {t("passwordLabel")}
        </span>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
          <input
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            className={fieldClass}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-[color:var(--glass-ink-faint)] transition hover:text-[color:var(--glass-ink)]"
            aria-label={showPassword ? t("hide") : t("show")}
          >
            {showPassword ? (
              <EyeOffIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </button>
        </div>
      </label>

      <div className="flex justify-end">
        <Link
          href="/mot-de-passe-oublie"
          className="text-[12.5px] font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
        >
          {t("forgotPassword")}
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: "var(--glass-ink)",
          color: "var(--glass-bg-a)",
        }}
      >
        {loading ? (
          <LoaderCircleIcon className="size-4 animate-spin" />
        ) : null}
        {loading ? t("signingIn") : t("signIn")}
      </button>

      {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" ? (
        <>
          <div className="relative flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
            <span
              className="h-px flex-1"
              style={{ background: "var(--glass-ink-line)" }}
            />
            {t("orContinueWith")}
            <span
              className="h-px flex-1"
              style={{ background: "var(--glass-ink-line)" }}
            />
          </div>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={handleGoogle}
              className="flex size-12 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] transition hover:bg-white/55 dark:hover:bg-white/10"
              aria-label={t("continueWithGoogle")}
            >
              <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </button>
          </div>
        </>
      ) : null}

      <p className="mt-2 text-center text-[12.5px] text-[color:var(--glass-ink-soft)]">
        {t("noAccountYet")}{" "}
        <Link
          href="/inscription"
          className="inline-flex items-center gap-1 font-bold text-[color:var(--glass-accent-deep)] hover:underline"
        >
          <UserPlusIcon className="size-3.5" />
          {t("signUp")}
        </Link>
      </p>
    </form>
  );
}

function LoginPageContent() {
  const t = useTranslations("public.auth");
  return (
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
            <div
              className="relative flex h-[280px] w-[220px] -rotate-6 flex-col gap-3 rounded-2xl bg-white/95 p-5 shadow-[0_18px_50px_rgba(40,15,80,0.30)]"
            >
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
            <div
              className="absolute -right-12 top-32 flex w-[140px] flex-col gap-1.5 rotate-[10deg] rounded-xl bg-white/95 p-3 shadow-[0_12px_30px_rgba(40,15,80,0.25)]"
            >
              <div className="h-1 rounded-full bg-[rgba(159,124,255,0.20)]" />
              <div className="h-1 w-1/2 rounded-full bg-[rgba(159,124,255,0.20)]" />
              <div className="h-1 w-3/4 rounded-full bg-[rgba(159,124,255,0.20)]" />
            </div>
          </div>
          <div className="relative max-w-sm">
            <p className="glass-display text-[28px] font-semibold leading-tight">
              {t("asideTitleLead")}{" "}
              <em className="not-italic text-white/90">{t("asideTitleEm")}</em>
            </p>
            <p className="mt-3 text-[14px] text-white/80">
              {t("asideSubtitle")}
            </p>
          </div>
        </div>
      </aside>

      <main className="relative flex flex-col p-6 sm:p-10 lg:p-14">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-white/55 dark:hover:bg-white/10"
        >
          <ArrowLeftIcon className="size-4" />
          {t("backToHome")}
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <header className="mb-8 flex flex-col gap-2 text-center sm:text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
              {t("welcomeEyebrow")}
            </p>
            <h1 className="glass-display text-[40px] font-semibold leading-[1.05] sm:text-[48px]">
              {t("title")}
            </h1>
            <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
              {t("subtitle")}
            </p>
          </header>

          <LoginForm />
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="glass-root">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <LoaderCircleIcon className="size-8 animate-spin text-[color:var(--glass-ink-soft)]" />
          </div>
        }
      >
        <LoginPageContent />
      </Suspense>
    </div>
  );
}
