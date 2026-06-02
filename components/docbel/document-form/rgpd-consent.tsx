"use client";

import { useState } from "react";
import { ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GLASS_CARD, GLASS_PRIMARY_STYLE } from "@/lib/glass-classes";

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
    <Card className={GLASS_CARD}>
      <CardHeader className="px-7 pt-7 pb-3">
        <CardTitle className="glass-display flex items-center gap-2 text-[22px] font-semibold">
          <ShieldCheckIcon
            className="size-5"
            style={{ color: "var(--glass-accent-deep)" }}
          />
          Avant de commencer — RGPD
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-7 pb-7">
        <p className="text-[13.5px] whitespace-pre-line text-[color:var(--glass-ink-soft)]">
          {text}
        </p>

        <label className="flex cursor-pointer items-start gap-2 text-[13px] text-[color:var(--glass-ink)] select-none">
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
              className="font-semibold text-[color:var(--glass-accent-deep)] underline underline-offset-2 hover:no-underline"
            >
              les conditions générales
            </button>{" "}
            et je consens au traitement de mes données pour générer ce document.
          </span>
        </label>

        <div className="flex justify-end">
          <Button
            onClick={onContinue}
            disabled={!accepted}
            className="rounded-full font-bold disabled:opacity-50"
            style={GLASS_PRIMARY_STYLE}
          >
            Commencer le formulaire
          </Button>
        </div>
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheckIcon
                className="size-5"
                style={{ color: "var(--glass-accent-deep)" }}
              />
              Conditions générales
            </DialogTitle>
            <DialogDescription>
              Veuillez lire attentivement avant de cocher la case de consentement.
            </DialogDescription>
          </DialogHeader>
          <div
            className="flex-1 overflow-y-auto rounded-2xl border border-[color:var(--glass-ink-line)] p-4"
            style={{ background: "var(--glass-surface)" }}
          >
            {loadingGeneral ? (
              <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
                Chargement…
              </p>
            ) : (
              <p className="text-[13px] whitespace-pre-line text-[color:var(--glass-ink)]">
                {generalText ||
                  "Aucun texte de conditions générales n'a été configuré."}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)]"
            >
              Fermer
            </Button>
            <Button
              onClick={() => {
                setAccepted(true);
                setModalOpen(false);
              }}
              className="rounded-full font-bold"
              style={GLASS_PRIMARY_STYLE}
            >
              J&apos;accepte les conditions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
