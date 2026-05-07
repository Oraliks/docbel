"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Mail, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DownloadActionsProps {
  generatedId: string;
  filename: string;
  downloadUrl: string;
  expiresAt: string;
  onRestart: () => void;
}

function getTokenFromUrl(url: string): string | null {
  try {
    const u = new URL(url, "http://x");
    return u.searchParams.get("token");
  } catch {
    return null;
  }
}

export function DownloadActions({
  generatedId,
  filename,
  downloadUrl,
  expiresAt,
  onRestart,
}: DownloadActionsProps) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailConsent, setEmailConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function sendEmail() {
    if (!email) {
      toast.error("Veuillez saisir une adresse email");
      return;
    }
    setSending(true);
    try {
      const token = getTokenFromUrl(downloadUrl);
      const res = await fetch(`/api/documents/generated/${generatedId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, token, consent: emailConsent }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec d'envoi");
      }
      setEmailSent(true);
      toast.success("Email envoyé");
      setEmailOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSending(false);
    }
  }

  const expires = new Date(expiresAt);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-500">
            <CheckCircle2 className="w-5 h-5" />
            Document généré
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <p>
              Votre document <code className="font-mono">{filename}</code> est prêt.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Disponible jusqu&apos;au {expires.toLocaleString("fr-BE")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button render={<a href={downloadUrl} download={filename} />}>
              <Download className="w-4 h-4 mr-1" />
              Télécharger
            </Button>
            <Button variant="outline" onClick={() => setEmailOpen(true)} disabled={emailSent}>
              <Mail className="w-4 h-4 mr-1" />
              {emailSent ? "Email envoyé" : "Envoyer par email"}
            </Button>
            <Button variant="ghost" onClick={onRestart}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Recommencer
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer le document par email</DialogTitle>
            <DialogDescription>
              Le document sera envoyé en pièce jointe à l&apos;adresse indiquée.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email-to">Adresse email</Label>
              <Input
                id="email-to"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@example.be"
              />
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={emailConsent}
                onCheckedChange={(c) => setEmailConsent(c === true)}
              />
              <span>
                Je consens à l&apos;envoi de ce document par email à l&apos;adresse indiquée.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>
              Annuler
            </Button>
            <Button onClick={sendEmail} disabled={sending || !email || !emailConsent}>
              {sending ? "Envoi…" : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
