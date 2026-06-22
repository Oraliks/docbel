"use client";

/**
 * Bannière inline affichée sous la dernière bulle assistant quand l'IA a
 * mentionné une référence légale (loi, AR, article, circulaire) qui n'est
 * PAS dans la KB. Propose à l'admin d'uploader la source manquante d'un
 * clic.
 *
 * Le composant est volontairement passif :
 *   - il reçoit la liste `missingRefs` et un callback `onOpenUpload`.
 *   - il s'affiche tant que `missingRefs.length > 0` (max 3 affichées
 *     côté serveur, donc pas besoin de couper côté client).
 *   - il peut être masqué par l'utilisateur via la croix : `onDismiss`.
 *
 * Le parent (`chat-full-shell`) décide où l'afficher dans le thread et
 * gère l'ouverture du modal upload simplifié.
 */

import { useTranslations } from "next-intl";
import { Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MissingSourcesHintProps {
  /** Liste des références détectées et non couvertes par la KB. */
  missingRefs: string[];
  /** Ouvre le modal upload simplifié (UploadQuickDialog). */
  onOpenUpload: () => void;
  /** Masque la bannière (sans persistance — au prochain message elle peut revenir). */
  onDismiss?: () => void;
  className?: string;
}

export function MissingSourcesHint({
  missingRefs,
  onOpenUpload,
  onDismiss,
  className,
}: MissingSourcesHintProps) {
  const t = useTranslations("admin.chomageIa");
  if (!missingRefs || missingRefs.length === 0) return null;

  return (
    <div
      className={cn(
        "mt-1 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Sparkles className="size-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <div className="flex-1 min-w-0">
        <p className="font-medium leading-snug">
          {t("missingSourcesTitle")}
        </p>
        <p className="mt-0.5 leading-snug">
          {missingRefs.map((ref, i) => (
            <span key={`${ref}-${i}`}>
              <span className="rounded bg-amber-200/50 px-1 py-0.5 font-mono text-[11px] dark:bg-amber-900/50">
                « {ref} »
              </span>
              {i < missingRefs.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 border-amber-400/60 bg-amber-100/40 px-2 text-[11.5px] text-amber-900 hover:bg-amber-200/50 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-100 dark:hover:bg-amber-900/50"
            onClick={onOpenUpload}
          >
            <Upload className="size-3" />
            {t("uploadNow")}
          </Button>
          <span className="text-[10.5px] text-amber-700 dark:text-amber-300/70">
            {t("missingSourcesHint")}
          </span>
        </div>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-amber-700/70 hover:text-amber-900 dark:text-amber-200/70 dark:hover:text-amber-100"
          aria-label={t("dismissSuggestion")}
          title={t("dismiss")}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
