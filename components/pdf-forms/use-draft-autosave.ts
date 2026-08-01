"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormPayload } from "@/lib/pdf-forms/types";

/// Sauvegarde automatique du brouillon d'un formulaire PDF, extraite du
/// `PdfFormRunner` (lot S12). Aucun changement de comportement : les deux
/// constantes, l'ordre des opérations et les filets de sécurité sont ceux
/// d'origine — ce fichier ne fait que leur donner un endroit à eux.

/// Report après la dernière frappe.
const DRAFT_DEBOUNCE_MS = 1500;
/// Plafond de report (Oraliks 2026-07-26). Le debounce était « trailing » pur :
/// chaque frappe repoussait la sauvegarde de 1,5 s, donc quelqu'un qui tape
/// lentement mais SANS PAUSE de 1,5 s — clavier virtuel, public en difficulté —
/// ne déclenchait jamais d'enregistrement. Au-delà de ce délai depuis la
/// dernière écriture, on écrit sans attendre.
const DRAFT_MAX_WAIT_MS = 10_000;

export interface DraftAutosave {
  /// Horodatage de la dernière écriture CONFIRMÉE par le serveur (null tant
  /// qu'aucune n'a abouti). Alimente `AutoSaveNotice`.
  lastSavedAt: Date | null;
  /// Note la frappe courante et programme son envoi (debounce + plafond).
  scheduleSave: (stepId: string | null, field: string) => void;
  /// Envoie MAINTENANT le brouillon en attente, s'il y en a un.
  flushDraft: () => void;
  /// Supprime le brouillon serveur et annule tout envoi en attente.
  discardDraft: () => void;
}

export function useDraftAutosave(options: {
  /// Slug du formulaire — segment de la route /api/pdf/<slug>/draft.
  slug: string;
  /// Route vers le brouillon du DOSSIER plutôt que vers le brouillon autonome.
  bundleRunId?: string;
  /// Valeurs courantes du formulaire. Suivies dans une ref pour que l'envoi
  /// lise toujours l'état le plus frais sans se re-créer à chaque frappe.
  values: FormPayload;
}): DraftAutosave {
  const { slug, bundleRunId, values } = options;

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sauvegarde en attente : les valeurs vivent dans `valuesRef` (toujours à
  // jour), on ne mémorise ici que le contexte de la dernière frappe.
  const pendingSave = useRef<{ stepId: string | null; field: string } | null>(null);
  const lastSaveStartedAt = useRef(0);
  const valuesRef = useRef<FormPayload>(values);
  const mounted = useRef(true);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  /// Supprime le brouillon du BON périmètre après une soumission réussie.
  ///
  /// Le `bundleRunId` est indispensable (Oraliks 2026-07-26) : sans lui, la
  /// route retombait sur le brouillon AUTONOME. Pour un citoyen anonyme en
  /// dossier elle répondait 401 et `draftPayloads` n'était jamais purgé — le
  /// brouillon périmé se restaurait par-dessus les réponses validées. Pour un
  /// connecté, elle supprimait son brouillon autonome d'un tout autre parcours.
  /// On annule aussi la sauvegarde en attente : sans ça, le minuteur en cours
  /// pouvait recréer le brouillon juste après l'avoir effacé.
  const discardDraft = useCallback(() => {
    pendingSave.current = null;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    fetch(`/api/pdf/${slug}/draft`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundleRunId }),
    }).catch(() => {});
  }, [slug, bundleRunId]);

  /// Envoie MAINTENANT le brouillon en attente, s'il y en a un. Lit les valeurs
  /// dans `valuesRef` (jamais dans un updater `setValues` — un updater React
  /// doit rester pur ; l'ancien code y déclenchait le `fetch`, ce qui produisait
  /// deux PUT par sauvegarde en StrictMode).
  const flushDraft = useCallback(() => {
    const pending = pendingSave.current;
    if (!pending) return;
    pendingSave.current = null;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    lastSaveStartedAt.current = Date.now();
    fetch(`/api/pdf/${slug}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // `bundleRunId` route vers le brouillon serveur du dossier (anonyme
      // possible) ; `stepId`/`field` alimentent la reprise fine (Lot 3).
      body: JSON.stringify({
        payload: valuesRef.current,
        stepId: pending.stepId,
        field: pending.field,
        bundleRunId,
      }),
      // `keepalive` : la requête survit à la fermeture de l'onglet, ce qui rend
      // le flush sur `visibilitychange` réellement utile sur mobile.
      keepalive: true,
    })
      // N'affiche « enregistré » QUE si le serveur a réellement persisté
      // (corrige le faux « enregistré » sur un 401 anonyme autonome).
      .then((res) => {
        if (res.ok && mounted.current) setLastSavedAt(new Date());
      })
      .catch(() => {});
  }, [slug, bundleRunId]);

  // Filets de la sauvegarde auto : on n'attend jamais indéfiniment.
  //   • onglet masqué / fermé → on écrit tout de suite ;
  //   • démontage (navigation vers un autre document) → idem, et on annule le
  //     minuteur en cours pour ne pas écrire après coup.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      flushDraft();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [flushDraft]);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const scheduleSave = useCallback(
    (stepId: string | null, field: string) => {
      pendingSave.current = { stepId, field };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (Date.now() - lastSaveStartedAt.current >= DRAFT_MAX_WAIT_MS) {
        flushDraft();
        return;
      }
      saveTimer.current = setTimeout(flushDraft, DRAFT_DEBOUNCE_MS);
    },
    [flushDraft],
  );

  return { lastSavedAt, scheduleSave, flushDraft, discardDraft };
}
