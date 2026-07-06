"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useReportSubmit } from "@/components/reports/use-report-submit";

export interface ReportButtonProps {
  type: string;
  targetId?: string;
  /// Catégories affichées en select (ex. raisons RioLex/formations). Absent
  /// = pas de select, juste le message libre.
  categories?: readonly { value: string; label: string }[];
  /// Payload additionnel fixe à joindre (ex. { loi, articleNumber } pour RioLex).
  extraPayload?: Record<string, unknown>;
  triggerLabel?: string;
  dialogTitle?: string;
}

/// Bouton + dialog de signalement générique, réutilisable pour toute
/// nouvelle fonctionnalité. Anonyme (email optionnel) ou auto-identifié
/// (aucun champ) selon la session — décidé serveur, pas ici : ce composant
/// envoie juste `reporterEmail` si rempli, le serveur l'ignore s'il y a une
/// session active.
export function ReportButton({
  type,
  targetId,
  categories,
  extraPayload,
  triggerLabel,
  dialogTitle,
}: ReportButtonProps) {
  const t = useTranslations("public.reports");
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(categories?.[0]?.value ?? "");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const { submit, status, error } = useReportSubmit(type);

  async function handleSubmit() {
    const payload = { ...(extraPayload ?? {}), ...(categories ? { category } : {}) };
    await submit({ targetId, message: message.trim(), payload, reporterEmail: email.trim() || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground print:hidden"
          >
            <Flag className="size-4" aria-hidden />
            {triggerLabel ?? t("triggerLabel")}
          </button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle ?? t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        {status === "done" ? (
          <div className="rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-800 dark:text-green-300">
            {t("doneMessage")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {categories ? (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("categoryLabel")}</Label>
                <Select value={category} onValueChange={(v) => setCategory(v ?? categories[0].value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <Label htmlFor="report-message" className="text-xs">
                {t("messageLabel")}
              </Label>
              <Textarea
                id="report-message"
                rows={3}
                maxLength={1000}
                placeholder={t("messagePlaceholder")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="report-email" className="text-xs">
                {t("emailLabel")}
              </Label>
              <Input
                id="report-email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          {status === "done" ? (
            <Button type="button" onClick={() => setOpen(false)}>
              {t("close")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={status === "submitting"}>
                {status === "submitting" ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
                {status === "submitting" ? t("submitting") : t("submit")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
