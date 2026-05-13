"use client";

import { useState } from "react";
import { Copy, Check, Mail, KeyRound, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  runId: string;
  resumeCode: string;
  resumeCodeExpiresAt: string | null;
  initialResumeEmail: string | null;
}

/// Bannière affichée en tête de parcours pour informer l'utilisateur :
/// - du code de reprise visible à conserver
/// - de la possibilité de se l'envoyer par email
/// - de l'avertissement "données perdues si non sauvegardé"
export function ResumeCodeBanner({
  runId,
  resumeCode,
  resumeCodeExpiresAt,
  initialResumeEmail,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState(initialResumeEmail ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(!!initialResumeEmail);
  const [showEmailField, setShowEmailField] = useState(!initialResumeEmail);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function copyCode() {
    navigator.clipboard.writeText(resumeCode).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Code copié dans le presse-papier");
      },
      () => toast.error("Impossible de copier — sélectionnez le code manuellement")
    );
  }

  async function sendEmail() {
    if (!email || !email.includes("@")) {
      toast.error("Entrez une adresse email valide");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/bundles/runs/${runId}/email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Échec d'envoi");
        return;
      }
      setSent(true);
      toast.success(`Code envoyé à ${email}`);
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSending(false);
    }
  }

  const expiresAtText = resumeCodeExpiresAt
    ? new Date(resumeCodeExpiresAt).toLocaleDateString("fr-BE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "30 jours";

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-3 text-sm space-y-3">
      <div className="flex items-start gap-2">
        <KeyRound className="size-4 mt-0.5 text-amber-700 dark:text-amber-300 flex-shrink-0" />
        <div className="flex-1 space-y-1 min-w-0">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Conservez votre code de reprise
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Sans ce code, vous ne pourrez pas reprendre votre dossier depuis un
            autre appareil ou après avoir effacé vos cookies. <strong>Aucune donnée
            nominative n&apos;est conservée :</strong> si vous ne le sauvegardez pas,
            les informations saisies seront <strong>perdues</strong> au bout du{" "}
            {expiresAtText}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-700 hover:text-amber-900 dark:text-amber-300"
          aria-label="Masquer"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <code className="bg-amber-100 dark:bg-amber-900 px-3 py-1.5 rounded font-mono text-base tracking-[0.12em] font-semibold text-amber-900 dark:text-amber-100 select-all">
          {resumeCode}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={copyCode}
          className="bg-white/60 dark:bg-amber-900/40"
        >
          {copied ? (
            <>
              <Check className="size-3.5" /> Copié
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copier
            </>
          )}
        </Button>
        {!showEmailField && !sent && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowEmailField(true)}
            className="bg-white/60 dark:bg-amber-900/40"
          >
            <Mail className="size-3.5" /> Recevoir par email
          </Button>
        )}
        {sent && (
          <span className="text-xs text-amber-800 dark:text-amber-300 inline-flex items-center gap-1">
            <Check className="size-3.5" /> Envoyé à {email}
          </span>
        )}
      </div>

      {showEmailField && !sent && (
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end pt-1">
          <div className="flex-1">
            <Label htmlFor="resume-email" className="text-xs text-amber-900 dark:text-amber-200">
              Adresse email
            </Label>
            <Input
              id="resume-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="votre@email.be"
              className="h-9 mt-1"
              autoComplete="email"
              disabled={sending}
            />
          </div>
          <Button size="sm" onClick={sendEmail} disabled={sending || !email.includes("@")}>
            {sending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Envoi…
              </>
            ) : (
              "Envoyer"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
