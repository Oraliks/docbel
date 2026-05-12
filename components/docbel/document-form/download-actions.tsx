"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  DownloadIcon,
  MailIcon,
  RotateCcwIcon,
} from "lucide-react";
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
import {
  GLASS_CARD,
  GLASS_INPUT,
  GLASS_LABEL,
  GLASS_PRIMARY_STYLE,
} from "@/lib/glass-classes";

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
      const res = await fetch(
        `/api/documents/generated/${generatedId}/email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: email, token, consent: emailConsent }),
        },
      );
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
      <Card className={GLASS_CARD}>
        <CardHeader className="px-7 pt-7 pb-3">
          <CardTitle
            className="glass-display flex items-center gap-2 text-[22px] font-semibold"
            style={{ color: "#1d6b3e" }}
          >
            <span
              className="flex size-9 items-center justify-center rounded-2xl text-white"
              style={{
                backgroundImage: "linear-gradient(135deg, #80E0C0, #40C0A0)",
              }}
            >
              <CheckCircle2Icon className="size-5" />
            </span>
            Document généré
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-7 pb-7">
          <div className="text-[13.5px] text-[color:var(--glass-ink)]">
            <p>
              Votre document{" "}
              <code
                className="rounded-md px-1.5 py-0.5 font-mono text-[12.5px]"
                style={{ background: "var(--glass-surface)" }}
              >
                {filename}
              </code>{" "}
              est prêt.
            </p>
            <p className="mt-1 text-[12px] text-[color:var(--glass-ink-faint)]">
              Disponible jusqu&apos;au {expires.toLocaleString("fr-BE")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              render={<a href={downloadUrl} download={filename} />}
              className="rounded-full font-bold"
              style={GLASS_PRIMARY_STYLE}
            >
              <DownloadIcon className="w-4 h-4 mr-1" />
              Télécharger
            </Button>
            <Button
              variant="outline"
              onClick={() => setEmailOpen(true)}
              disabled={emailSent}
              className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
            >
              <MailIcon className="w-4 h-4 mr-1" />
              {emailSent ? "Email envoyé" : "Envoyer par email"}
            </Button>
            <Button
              variant="ghost"
              onClick={onRestart}
              className="rounded-full text-[color:var(--glass-ink-soft)] hover:bg-white/40 dark:hover:bg-white/8"
            >
              <RotateCcwIcon className="w-4 h-4 mr-1" />
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
              Le document sera envoyé en pièce jointe à l&apos;adresse
              indiquée.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email-to" className={GLASS_LABEL}>
                Adresse email
              </Label>
              <Input
                id="email-to"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@example.be"
                className={GLASS_INPUT}
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-[13px] text-[color:var(--glass-ink)]">
              <Checkbox
                checked={emailConsent}
                onCheckedChange={(c) => setEmailConsent(c === true)}
              />
              <span>
                Je consens à l&apos;envoi de ce document par email à
                l&apos;adresse indiquée.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmailOpen(false)}
              className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)]"
            >
              Annuler
            </Button>
            <Button
              onClick={sendEmail}
              disabled={sending || !email || !emailConsent}
              className="rounded-full font-bold"
              style={GLASS_PRIMARY_STYLE}
            >
              {sending ? "Envoi…" : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
