"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2Icon,
  Loader2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <Card className="w-full">
        <CardHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
            <Loader2Icon className="size-6 animate-spin" />
          </div>
          <CardTitle>Activation en cours…</CardTitle>
          <CardDescription>
            Nous vérifions votre lien d&apos;activation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <CheckCircle2Icon className="size-6" />
          </div>
          <CardTitle>Compte activé !</CardTitle>
          <CardDescription>
            Votre adresse email est confirmée. Vous pouvez maintenant vous
            connecter à votre espace partenaire.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button render={<Link href="/" />}>Se connecter</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircleIcon className="size-6" />
        </div>
        <CardTitle>Activation impossible</CardTitle>
        <CardDescription>{errorMessage}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center gap-2">
        <Button
          variant="outline"
          render={<Link href="/inscription/partenaire" />}
        >
          Recommencer l&apos;inscription
        </Button>
      </CardContent>
    </Card>
  );
}
