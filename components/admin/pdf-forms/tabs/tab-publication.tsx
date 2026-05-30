"use client";

import { CheckCircle2Icon, AlertTriangleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { UseFormData } from "../use-form-data";

export function TabPublication({ data }: { data: UseFormData }) {
  const { form, issues, busy, publish, unpublish } = data;
  if (!form) return null;

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  const disabled = busy === "publish" || errors.length > 0;
  const reason =
    errors.length > 0
      ? `Corrigez ${errors.length} erreur${errors.length > 1 ? "s" : ""} ci-dessous pour publier.`
      : form.fields.length === 0
      ? "Ajoutez au moins un champ avant de publier."
      : "Publier le formulaire.";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-1.5 py-4 text-sm">
          {errors.length === 0 && warnings.length === 0 ? (
            form.status === "published" ? (
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2Icon className="size-4 shrink-0" /> Formulaire publié — aucune anomalie détectée.
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2Icon className="size-4 shrink-0" /> Prêt à publier — aucune erreur ni avertissement.
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
            Dépublier
          </Button>
        ) : (
          <Tooltip>
            {/* Un <button disabled> ne déclenche pas les events souris, donc le
                tooltip ne s'afficherait pas. On enveloppe d'un span focusable
                pour exposer l'explication même bouton désactivé. */}
            <TooltipTrigger render={<span tabIndex={disabled ? 0 : -1} className="inline-flex" />}>
              <Button size="sm" onClick={publish} disabled={disabled}>
                {busy === "publish" ? <Loader2Icon className="size-4 animate-spin" /> : <CheckCircle2Icon className="size-4" />} Publier
              </Button>
            </TooltipTrigger>
            <TooltipContent>{reason}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
