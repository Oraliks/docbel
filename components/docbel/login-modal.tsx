"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  AlertCircleIcon,
  LoaderCircleIcon,
  LogInIcon,
  MailIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface LoginModalProps {
  accent: string;
  onClose: () => void;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Email ou mot de passe incorrect.",
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
  account_inactive: "Ce compte est inactif. Contactez un administrateur.",
  account_locked: "Compte temporairement verrouillé après plusieurs tentatives.",
}

function getAuthErrorMessage(error: { code?: string | null; message?: string | null } | null | undefined) {
  const key = error?.code || ""
  if (key && AUTH_ERROR_MESSAGES[key]) return AUTH_ERROR_MESSAGES[key]
  if (error?.message) return error.message
  return "Connexion impossible. Vérifiez vos identifiants."
}

export function LoginModal({ onClose }: LoginModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  const handleMagicLink = async () => {
    if (!email) {
      setError("Saisissez votre email pour recevoir un lien de connexion.");
      return;
    }
    setMagicLoading(true);
    setError("");
    try {
      const { error: mlError } = await authClient.signIn.magicLink({
        email,
        callbackURL: "/partenaire",
      });
      if (mlError) {
        const errorMessage = getAuthErrorMessage(mlError);
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }
      setMagicLinkSent(true);
      toast.success("Email envoyé");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setMagicLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email,
        password: pwd,
      });

      if (signInError || !data?.user) {
        const errorMessage = getAuthErrorMessage(signInError);
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      router.refresh();
      toast.success("Connexion réussie");
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connexion</DialogTitle>
          <DialogDescription>
            Connectez-vous pour retrouver vos documents et acceder a l&apos;administration.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Connexion impossible</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="login-email">Adresse e-mail</FieldLabel>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nom@exemple.be"
                disabled={loading}
                autoComplete="email"
              />
              <FieldDescription>Utilisez l&apos;adresse associee a votre compte.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="login-password">Mot de passe</FieldLabel>
              <Input
                id="login-password"
                type="password"
                value={pwd}
                onChange={(event) => setPwd(event.target.value)}
                placeholder="Votre mot de passe"
                disabled={loading}
                autoComplete="current-password"
              />
              <FieldError>{error ? "Verifiez vos identifiants puis reessayez." : undefined}</FieldError>
            </Field>
          </FieldGroup>

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !email || !pwd}>
              {loading ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : <LogInIcon data-icon="inline-start" />}
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Partenaires
              </span>
            </div>
          </div>

          {magicLinkSent ? (
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
              <div className="flex-1 text-emerald-800 dark:text-emerald-200">
                Un lien de connexion a été envoyé à <strong>{email}</strong>.
                Cliquez dessus pour vous connecter (valable 15 minutes).
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleMagicLink}
              disabled={magicLoading || loading || !email}
              className="w-full"
            >
              {magicLoading ? (
                <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
              ) : (
                <MailIcon data-icon="inline-start" />
              )}
              {magicLoading
                ? "Envoi du lien…"
                : "Recevoir un lien de connexion (sans mot de passe)"}
            </Button>
          )}

          {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await authClient.signIn.social({
                    provider: "google",
                    callbackURL: "/partenaire",
                  });
                } catch (err) {
                  const errorMessage =
                    err instanceof Error ? err.message : "Erreur inconnue";
                  setError(errorMessage);
                  toast.error(errorMessage);
                }
              }}
              disabled={loading || magicLoading}
              className="w-full"
            >
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                aria-hidden="true"
                data-icon="inline-start"
              >
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
              Se connecter avec Google
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
