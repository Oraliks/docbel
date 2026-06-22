"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2Icon, AlertTriangleIcon, Loader2Icon, EyeOffIcon, EyeIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { UseFormData } from "../use-form-data";

export function TabPublication({ data }: { data: UseFormData }) {
  const t = useTranslations("admin.pdf");
  const { form, issues, busy, publish, unpublish, patchForm } = data;
  if (!form) return null;

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  const disabled = busy === "publish" || errors.length > 0;
  const reason =
    errors.length > 0
      ? t("publishReasonErrorsBelow", { count: errors.length })
      : form.fields.length === 0
      ? t("publishReasonNoFields")
      : t("publishReasonReady");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-1.5 py-4 text-sm">
          {errors.length === 0 && warnings.length === 0 ? (
            form.status === "published" ? (
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2Icon className="size-4 shrink-0" /> {t("publishedNoIssues")}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2Icon className="size-4 shrink-0" /> {t("readyNoIssues")}
              </div>
            )
          ) : (
            <>
              {errors.map((i, k) => (
                <div key={`e${k}`} className="flex items-center gap-2 text-destructive">
                  <AlertTriangleIcon className="size-4 shrink-0" /> {i.message}
                </div>
              ))}
              {warnings.map((i, k) => (
                <div key={`w${k}`} className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangleIcon className="size-4 shrink-0" /> {i.message}
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        {form.status === "published" ? (
          <Button variant="secondary" size="sm" onClick={unpublish} disabled={busy === "unpublish"}>
            {t("unpublish")}
          </Button>
        ) : (
          <Tooltip>
            {/* Un <button disabled> ne déclenche pas les events souris, donc le
                tooltip ne s'afficherait pas. On enveloppe d'un span focusable
                pour exposer l'explication même bouton désactivé. */}
            <TooltipTrigger render={<span tabIndex={disabled ? 0 : -1} className="inline-flex" />}>
              <Button size="sm" onClick={publish} disabled={disabled}>
                {busy === "publish" ? <Loader2Icon className="size-4 animate-spin" /> : <CheckCircle2Icon className="size-4" />} {t("publish")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{reason}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {form.status === "published" && (
        <AvailabilityCard
          formId={form.id}
          active={form.active}
          disabledMessage={form.disabledMessage}
          onChange={(next) => patchForm(next)}
        />
      )}
    </div>
  );
}

/// Bloc "Disponibilité publique" — uniquement visible quand le formulaire est
/// publié. Permet de le mettre en pause (sans dépublier) le temps d'une
/// correction ou d'une mise à jour du document officiel.
function AvailabilityCard({
  formId,
  active,
  disabledMessage,
  onChange,
}: {
  formId: string;
  active: boolean;
  disabledMessage: string | null;
  onChange: (next: { active?: boolean; disabledMessage?: string | null }) => void;
}) {
  const t = useTranslations("admin.pdf");
  const [savingActive, setSavingActive] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [draftMessage, setDraftMessage] = useState(disabledMessage ?? "");
  // Re-sync le brouillon local quand le message côté serveur change (par ex.
  // après save d'un autre tab). Pattern React 19 « ajuster un state quand une
  // prop change » : comparaison pendant le render, pas dans un useEffect.
  const [lastServerMessage, setLastServerMessage] = useState(disabledMessage);
  if (disabledMessage !== lastServerMessage) {
    setLastServerMessage(disabledMessage);
    setDraftMessage(disabledMessage ?? "");
  }

  async function patch(payload: { active?: boolean; disabledMessage?: string | null }) {
    const res = await fetch(`/api/admin/pdf/forms/${formId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error(t("toastSaveError"));
      throw new Error("patch failed");
    }
    onChange(payload);
  }

  async function toggleActive(next: boolean) {
    setSavingActive(true);
    try {
      await patch({ active: next });
      toast.success(next ? t("toastFormOnline") : t("toastFormPaused"));
    } catch {
      // toast déjà émis
    } finally {
      setSavingActive(false);
    }
  }

  async function saveMessage() {
    const value = draftMessage.trim() || null;
    setSavingMessage(true);
    try {
      await patch({ disabledMessage: value });
      toast.success(t("toastMessageSaved"));
    } catch {
      // toast déjà émis
    } finally {
      setSavingMessage(false);
    }
  }

  const messageDirty = (draftMessage.trim() || "") !== (disabledMessage ?? "");

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <Label className="flex items-center gap-2 text-sm font-medium">
              {active ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
              {t("publicAvailability")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {active ? t("availabilityOnDesc") : t("availabilityOffDesc")}
            </p>
          </div>
          <Switch checked={active} disabled={savingActive} onCheckedChange={toggleActive} />
        </div>

        {!active && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="disabled-message" className="text-xs">
              {t("disabledMessageLabel")}
            </Label>
            <Textarea
              id="disabled-message"
              rows={3}
              maxLength={500}
              value={draftMessage}
              placeholder={t("disabledMessagePlaceholder")}
              onChange={(e) => setDraftMessage(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {t("disabledMessageHint")}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={saveMessage}
                disabled={!messageDirty || savingMessage}
              >
                {savingMessage && <Loader2Icon className="size-3.5 animate-spin" />}
                {t("saveMessage")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
