"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SendIcon, MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PartnerEmailTestSender() {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const to = email.trim();
    if (!to) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/partenaires/email/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Echec de l'envoi");
          return;
        }
        toast.success(data.message || `Email envoyé à ${to}`);
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MailIcon className="size-4" />
          Envoyer un email de test
        </CardTitle>
        <CardDescription>
          Envoie un échantillon de l&apos;email d&apos;invitation à
          l&apos;adresse de votre choix avec des données fictives
          (organisation : &quot;Organisation de test&quot;). Utilise les
          valeurs <strong>actuellement sauvegardées</strong> en base — pensez
          à sauvegarder vos modifications avant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSend}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="test-email">Adresse destinataire</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="vous@exemple.be"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={isPending || !email.trim()}>
            <SendIcon className="size-4" />
            {isPending ? "Envoi…" : "Envoyer le test"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
