"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const CATEGORIES = [
  { value: "hours", label: "Horaires faux ou obsolètes" },
  { value: "address", label: "Adresse incorrecte" },
  { value: "phone", label: "Numéro de téléphone faux" },
  { value: "closed", label: "Bureau fermé / déménagé" },
  { value: "other", label: "Autre" },
];

export function BureauReportDialog({
  open,
  onOpenChange,
  bureauId,
  bureauName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bureauId: string;
  bureauName: string;
}) {
  const [category, setCategory] = useState("hours");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function reset() {
    setCategory("hours");
    setMessage("");
    setEmail("");
    setSubmitted(false);
  }

  async function submit() {
    if (message.trim().length < 5) {
      toast.error("Décrivez l'erreur en au moins 5 caractères");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/bureaux/${bureauId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: message.trim(),
          reporterEmail: email.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Échec de l'envoi");
        return;
      }
      setSubmitted(true);
      toast.success("Merci, signalement enregistré");
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Signaler une erreur</DialogTitle>
          <DialogDescription>
            <strong>{bureauName}</strong> — votre signalement aide à maintenir des coordonnées
            exactes pour tous.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-4 text-sm text-center">
            ✅ Signalement envoyé. Notre équipe va vérifier.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Type d&apos;erreur</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "other")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Description *</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex: les horaires affichés sont 9h-12h mais le bureau ouvre à 8h."
                rows={4}
                maxLength={1000}
              />
              <div className="text-[10px] text-right text-muted-foreground mt-0.5">
                {message.length}/1000
              </div>
            </div>
            <div>
              <Label className="text-xs">Votre email (optionnel)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Pour qu'on puisse revenir vers vous si besoin"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {submitted ? (
            <Button onClick={() => onOpenChange(false)}>Fermer</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Annuler
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Envoyer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
