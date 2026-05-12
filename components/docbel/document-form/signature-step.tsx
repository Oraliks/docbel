"use client";

import { useState } from "react";
import {
  ChevronLeftIcon,
  FileSignatureIcon,
  Loader2Icon,
  ShieldIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SignatureCanvas,
  SignatureResult,
} from "@/components/documents/signature-canvas";
import { Lang } from "@/lib/documents/types";
import {
  GLASS_CARD,
  GLASS_INPUT,
  GLASS_LABEL,
  GLASS_PRIMARY_STYLE,
} from "@/lib/glass-classes";

interface SignatureState {
  dataUrl: string;
  method: "drawn" | "typed" | "uploaded";
  signerName: string;
  signerEmail: string;
}

interface SignatureStepProps {
  requiresSignature: boolean;
  initialName: string;
  initialEmail: string;
  signature: SignatureState | null;
  onSignatureChange: (sig: SignatureState | null) => void;
  onBack: () => void;
  onConfirm: () => void;
  generating: boolean;
  lang: Lang;
}

export function SignatureStep({
  initialName,
  initialEmail,
  signature,
  onSignatureChange,
  onBack,
  onConfirm,
  generating,
  lang,
}: SignatureStepProps) {
  const [signerName, setSignerName] = useState(
    signature?.signerName || initialName,
  );
  const [signerEmail, setSignerEmail] = useState(
    signature?.signerEmail || initialEmail,
  );
  const [drawn, setDrawn] = useState<SignatureResult | null>(
    signature
      ? { dataUrl: signature.dataUrl, method: signature.method }
      : null,
  );
  const [accepted, setAccepted] = useState(false);

  function handleSignatureChange(result: SignatureResult | null) {
    setDrawn(result);
    if (!result) {
      onSignatureChange(null);
      return;
    }
    onSignatureChange({
      dataUrl: result.dataUrl,
      method: result.method,
      signerName: signerName.trim(),
      signerEmail: signerEmail.trim(),
    });
  }

  function syncMeta(name: string, email: string) {
    setSignerName(name);
    setSignerEmail(email);
    if (drawn) {
      onSignatureChange({
        dataUrl: drawn.dataUrl,
        method: drawn.method,
        signerName: name.trim(),
        signerEmail: email.trim(),
      });
    }
  }

  const ready = !!drawn && signerName.trim().length >= 2 && accepted;

  return (
    <Card className={GLASS_CARD}>
      <CardHeader className="px-7 pt-7 pb-3">
        <CardTitle className="glass-display flex items-center gap-2 text-[22px] font-semibold">
          <FileSignatureIcon
            className="size-5"
            style={{ color: "var(--glass-accent-deep)" }}
          />
          {lang === "nl"
            ? "Elektronische handtekening"
            : "Signature électronique"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-7 pb-7">
        <div
          className="flex items-start gap-3 rounded-2xl p-4 text-[13px]"
          style={{
            background: "rgba(159, 124, 255, 0.12)",
            color: "var(--glass-ink-soft)",
          }}
        >
          <ShieldIcon
            className="mt-0.5 size-4 shrink-0"
            style={{ color: "var(--glass-accent-deep)" }}
          />
          <p>
            {lang === "nl"
              ? "Door dit document te ondertekenen, gaat u akkoord met de inhoud. Een audittrail (datum, tijd, IP, hash) wordt bewaard ter staving."
              : "En signant ce document, vous en acceptez le contenu. Un audit (date, heure, IP, empreinte numérique) est conservé pour preuve."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className={GLASS_LABEL}>
              {lang === "nl" ? "Volledige naam *" : "Nom complet *"}
            </Label>
            <Input
              value={signerName}
              onChange={(e) => syncMeta(e.target.value, signerEmail)}
              placeholder={lang === "nl" ? "Jan Janssens" : "Jean Dupont"}
              required
              className={GLASS_INPUT}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className={GLASS_LABEL}>
              {lang === "nl" ? "E-mail (optioneel)" : "E-mail (optionnel)"}
            </Label>
            <Input
              type="email"
              value={signerEmail}
              onChange={(e) => syncMeta(signerName, e.target.value)}
              placeholder="jean.dupont@example.be"
              className={GLASS_INPUT}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className={GLASS_LABEL}>
            {lang === "nl" ? "Uw handtekening *" : "Votre signature *"}
          </Label>
          <SignatureCanvas height={200} onChange={handleSignatureChange} />
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-[13px] text-[color:var(--glass-ink)]">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 size-4 accent-[color:var(--glass-accent-deep)]"
          />
          <span>
            {lang === "nl"
              ? "Ik bevestig dat de gegevens juist zijn en ik onderteken dit document elektronisch."
              : "Je confirme que les informations sont exactes et signe ce document électroniquement."}
          </span>
        </label>

        <div className="flex justify-between gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={generating}
            className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
          >
            <ChevronLeftIcon className="w-4 h-4 mr-1" />
            {lang === "nl" ? "Terug" : "Retour"}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!ready || generating}
            className="rounded-full font-bold disabled:opacity-50"
            style={GLASS_PRIMARY_STYLE}
          >
            {generating ? (
              <>
                <Loader2Icon className="w-4 h-4 mr-1 animate-spin" />
                {lang === "nl" ? "Ondertekenen…" : "Signature en cours…"}
              </>
            ) : (
              <>
                <FileSignatureIcon className="w-4 h-4 mr-1" />
                {lang === "nl"
                  ? "Ondertekenen en genereren"
                  : "Signer et générer"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
