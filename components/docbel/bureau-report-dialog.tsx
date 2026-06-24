"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

// Catégories d'erreurs : la value est stable côté API, seul le label est
// traduit via une clé `brCat*` du namespace `public.outils`.
const CATEGORIES: { value: string; labelKey: string }[] = [
  { value: "hours", labelKey: "brCatHours" },
  { value: "address", labelKey: "brCatAddress" },
  { value: "phone", labelKey: "brCatPhone" },
  { value: "closed", labelKey: "brCatClosed" },
  { value: "other", labelKey: "brCatOther" },
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
  const t = useTranslations("public.outils");
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
      toast.error(t("brErrTooShort"));
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
        toast.error(data?.error ?? t("brErrSubmit"));
        return;
      }
      setSubmitted(true);
      toast.success(t("brSuccessToast"));
    } catch (err) {
      console.error(err);
      toast.error(t("brErrNetwork"));
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
          <DialogTitle>{t("brTitle")}</DialogTitle>
          <DialogDescription>
            <strong>{bureauName}</strong> — {t("brDescriptionPrefix")}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-4 text-sm text-center">
            ✅ {t("brSubmittedConfirm")}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("brCategoryLabel")}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "other")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {t(c.labelKey as Parameters<typeof t>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("brMessageLabel")}</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("brMessagePlaceholder")}
                rows={4}
                maxLength={1000}
              />
              <div className="text-[10px] text-right text-muted-foreground mt-0.5">
                {t("brMessageCounter", { count: message.length, max: 1000 })}
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("brEmailLabel")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("brEmailPlaceholder")}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {submitted ? (
            <Button onClick={() => onOpenChange(false)}>{t("brBtnClose")}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {t("brBtnCancel")}
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("brBtnSend")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
