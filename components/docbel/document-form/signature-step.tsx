"use client";

import { useState } from "react";
import { ChevronLeft, FileSignature, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignatureCanvas, SignatureResult } from "@/components/documents/signature-canvas";
import { Lang } from "@/lib/documents/types";

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
  const [signerName, setSignerName] = useState(signature?.signerName || initialName);
  const [signerEmail, setSignerEmail] = useState(signature?.signerEmail || initialEmail);
  const [drawn, setDrawn] = useState<SignatureResult | null>(
    signature ? { dataUrl: signature.dataUrl, method: signature.method } : null
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="w-5 h-5" />
          {lang === "nl" ? "Elektronische handtekening" : "Signature électronique"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Shield className="w-4 h-4" />
          <AlertDescription className="text-sm">
            {lang === "nl" ? (
              <>
                Door dit document te ondertekenen, gaat u akkoord met de inhoud. Een audittrail
                (datum, tijd, IP, hash) wordt bewaard ter staving.
              </>
            ) : (
              <>
                En signant ce document, vous en acceptez le contenu. Un audit (date, heure, IP,
                empreinte numérique) est conservé pour preuve.
              </>
            )}
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">
              {lang === "nl" ? "Volledige naam *" : "Nom complet *"}
            </Label>
            <Input
              value={signerName}
              onChange={(e) => syncMeta(e.target.value, signerEmail)}
              placeholder={lang === "nl" ? "Jan Janssens" : "Jean Dupont"}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              {lang === "nl" ? "E-mail (optioneel)" : "E-mail (optionnel)"}
            </Label>
            <Input
              type="email"
              value={signerEmail}
              onChange={(e) => syncMeta(signerName, e.target.value)}
              placeholder="jean.dupont@example.be"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            {lang === "nl" ? "Uw handtekening *" : "Votre signature *"}
          </Label>
          <SignatureCanvas height={200} onChange={handleSignatureChange} />
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 w-4 h-4"
          />
          <span>
            {lang === "nl"
              ? "Ik bevestig dat de gegevens juist zijn en ik onderteken dit document elektronisch."
              : "Je confirme que les informations sont exactes et signe ce document électroniquement."}
          </span>
        </label>

        <div className="flex justify-between gap-2 pt-2">
          <Button variant="outline" onClick={onBack} disabled={generating}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {lang === "nl" ? "Terug" : "Retour"}
          </Button>
          <Button onClick={onConfirm} disabled={!ready || generating}>
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {lang === "nl" ? "Ondertekenen…" : "Signature en cours…"}
              </>
            ) : (
              <>
                <FileSignature className="w-4 h-4 mr-1" />
                {lang === "nl" ? "Ondertekenen en genereren" : "Signer et générer"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
