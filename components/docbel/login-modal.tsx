"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { AlertCircleIcon, LoaderCircleIcon, LogInIcon } from "lucide-react";
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
  CredentialsSignin: "Email ou mot de passe incorrect.",
  invalid_credentials: "Email ou mot de passe incorrect.",
  account_inactive: "Ce compte est inactif. Contactez un administrateur.",
  account_locked: "Compte temporairement verrouillé après plusieurs tentatives.",
}

function getAuthErrorMessage(result: { error?: string | null; code?: string | null } | undefined) {
  const key = result?.code || result?.error || ""
  return AUTH_ERROR_MESSAGES[key] || "Connexion impossible. Vérifiez vos identifiants."
}

export function LoginModal({ onClose }: LoginModalProps) {
  const router = useRouter();
  const { update } = useSession();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password: pwd,
        redirect: false,
      });

      if (!result?.ok) {
        const errorMessage = getAuthErrorMessage(result);
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      const session = await update();
      if (!session?.user) {
        const errorMessage = "Session non confirmée. Réessayez la connexion.";
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
