"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface RgpdConsentProps {
  notice: string | null;
  onContinue: () => void;
}

const DEFAULT_NOTICE =
  "Les données saisies dans ce formulaire ne sont pas conservées en clair sur nos serveurs. Le document généré est disponible pendant la durée de conservation indiquée puis supprimé automatiquement.";

export function RgpdConsent({ notice, onContinue }: RgpdConsentProps) {
  const [accepted, setAccepted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [generalText, setGeneralText] = useState<string | null>(null);
  const [loadingGeneral, setLoadingGeneral] = useState(false);
  const text = notice && notice.trim().length > 0 ? notice : DEFAULT_NOTICE;

  async function openConditions() {
    setModalOpen(true);
    if (generalText !== null) return;
    setLoadingGeneral(true);
    try {
      const res = await fetch("/api/settings/public/rgpd");
      if (res.ok) {
        const data = await res.json();
        setGeneralText(data.value || "");
      } else {
        setGeneralText("");
      }
    } catch {
      setGeneralText("");
    } finally {
      setLoadingGeneral(false);
    }
  }

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

        <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
          <Checkbox
            checked={accepted}
            onCheckedChange={(c) => setAccepted(c === true)}
            className="mt-0.5"
          />
          <span>
            J&apos;ai pris connaissance des informations ci-dessus, j&apos;accepte{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                openConditions();
              }}
              className="text-primary underline underline-offset-2 hover:no-underline font-medium"
            >
              les conditions générales
            </button>{" "}
            et je consens au traitement de mes données pour générer ce document.
          </span>
        </label>

        <div className="flex justify-end">
          <Button onClick={onContinue} disabled={!accepted}>
            Commencer le formulaire
          </Button>
        </div>
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Conditions générales
            </DialogTitle>
            <DialogDescription>
              Veuillez lire attentivement avant de cocher la case de consentement.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto rounded border bg-muted/20 p-4">
            {loadingGeneral ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : (
              <p className="text-sm whitespace-pre-line">
                {generalText || "Aucun texte de conditions générales n'a été configuré."}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Fermer
            </Button>
            <Button
              onClick={() => {
                setAccepted(true);
                setModalOpen(false);
              }}
            >
              J&apos;accepte les conditions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
