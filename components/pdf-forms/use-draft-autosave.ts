"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormPayload } from "@/lib/pdf-forms/types";
import { isStagingTestPersistenceEnabled } from "@/lib/public-access";

const DRAFT_DEBOUNCE_MS = 1_500;
const DRAFT_MAX_WAIT_MS = 10_000;

type FetchResponse = Pick<Response, "ok">;
type DraftFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<FetchResponse>;

export interface DraftAutosave {
  lastSavedAt: Date | null;
  scheduleSave: (stepId: string | null, field: string) => void;
  flushDraft: () => void;
  discardDraft: () => void;
  resetSavedAt: () => void;
}

export interface DraftAutosaveActions extends DraftAutosave {
  dispose: () => void;
  updateValues: (values: FormPayload) => void;
}

const EPHEMERAL_DRAFT: DraftAutosave = {
  lastSavedAt: null,
  scheduleSave: () => {},
  flushDraft: () => {},
  discardDraft: () => {},
  resetSavedAt: () => {},
};

const NOOP_ACTIONS: DraftAutosaveActions = {
  ...EPHEMERAL_DRAFT,
  dispose: () => {},
  updateValues: () => {},
};

/// Actions testables sans DOM; la création et les effets restent déclenchés par le hook React.
export function createDraftAutosaveActions(options: {
  enabled: boolean;
  slug: string;
  bundleRunId?: string;
  values: FormPayload;
  onSaved: () => void;
  onResetSavedAt: () => void;
  fetcher?: DraftFetch;
}): DraftAutosaveActions {
  if (!options.enabled) return NOOP_ACTIONS;

  const fetcher = options.fetcher ?? fetch;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingSave: { stepId: string | null; field: string; revision: number } | null = null;
  let revision = 0;
  let lastSaveStartedAt = Date.now();
  let inFlightSave = false;
  let discardAfterInFlight = false;
  let currentValues = options.values;

  const clearSaveTimer = () => {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  };

  const sendDelete = () => {
    void fetcher(`/api/pdf/${options.slug}/draft`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundleRunId: options.bundleRunId }),
    }).catch(() => {});
  };

  const flushDraft = () => {
    const pending = pendingSave;
    if (!pending || inFlightSave) return;
    pendingSave = pending;
    clearSaveTimer();
    lastSaveStartedAt = Date.now();
    inFlightSave = true;
    const savedRevision = pending.revision;
    const body = JSON.stringify({
      payload: currentValues,
      stepId: pending.stepId,
      field: pending.field,
      bundleRunId: options.bundleRunId,
    });

    void fetcher(`/api/pdf/${options.slug}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    })
      .then((response) => {
        if (response.ok && pendingSave?.revision === savedRevision) {
          pendingSave = null;
          options.onSaved();
        }
      })
      .catch(() => {})
      .finally(() => {
        inFlightSave = false;
        if (discardAfterInFlight) {
          discardAfterInFlight = false;
          sendDelete();
          if (pendingSave) {
            saveTimer = setTimeout(flushDraft, DRAFT_DEBOUNCE_MS);
          }
          return;
        }
        // A newer edit waits behind the current request. A failed request is
        // retained for an explicit flush or the next edit, never retried forever.
        if (pendingSave && pendingSave.revision > savedRevision) flushDraft();
      });
  };

  const scheduleSave = (stepId: string | null, field: string) => {
    pendingSave = { stepId, field, revision: ++revision };
    options.onResetSavedAt();
    clearSaveTimer();
    if (Date.now() - lastSaveStartedAt >= DRAFT_MAX_WAIT_MS) {
      flushDraft();
      return;
    }
    saveTimer = setTimeout(flushDraft, DRAFT_DEBOUNCE_MS);
  };

  const discardDraft = () => {
    pendingSave = null;
    clearSaveTimer();
    options.onResetSavedAt();
    if (inFlightSave) {
      discardAfterInFlight = true;
      return;
    }
    sendDelete();
  };

  return {
    lastSavedAt: null,
    scheduleSave,
    flushDraft,
    discardDraft,
    resetSavedAt: options.onResetSavedAt,
    dispose: flushDraft,
    updateValues: (values) => { currentValues = values; },
  };
}

export function useDraftAutosave(options: {
  slug: string;
  bundleRunId?: string;
  values: FormPayload;
}): DraftAutosave {
  const enabled = isStagingTestPersistenceEnabled();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const actions = useMemo(() => createDraftAutosaveActions({
    enabled,
    slug: options.slug,
    bundleRunId: options.bundleRunId,
    values: {},
    onSaved: () => setLastSavedAt(new Date()),
    onResetSavedAt: () => setLastSavedAt(null),
  }), [enabled, options.slug, options.bundleRunId]);

  useEffect(() => actions.updateValues(options.values), [actions, options.values]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") actions.flushDraft();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      actions.dispose();
    };
  }, [actions, enabled]);

  return enabled ? { ...actions, lastSavedAt } : EPHEMERAL_DRAFT;
}
