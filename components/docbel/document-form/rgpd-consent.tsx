"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

interface RgpdConsentProps {
  notice: string | null;
  onContinue: () => void;
}

const DEFAULT_NOTICE =
  "Les données saisies dans ce formulaire ne sont pas conservées en clair sur nos serveurs. Le document généré est disponible pendant la durée de conservation indiquée puis supprimé automatiquement.";

export function RgpdConsent({ notice, onContinue }: RgpdConsentProps) {
  const [accepted, setAccepted] = useState(false);
  const text = notice && notice.trim().length > 0 ? notice : DEFAULT_NOTICE;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Avant de commencer — RGPD
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm whitespace-pre-line text-muted-foreground">{text}</p>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox checked={accepted} onCheckedChange={(c) => setAccepted(c === true)} />
          <span>
            J&apos;ai pris connaissance des informations ci-dessus et je consens au traitement de mes
            données pour générer ce document.
          </span>
        </label>
        <div className="flex justify-end">
          <Button onClick={onContinue} disabled={!accepted}>
            Commencer le formulaire
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
