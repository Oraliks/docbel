export type DocbelTextSize = "small" | "normal" | "large" | "xlarge";

export interface AccessibilityPreferences {
  textSize: DocbelTextSize;
  highContrast: boolean;
  simpleMode: boolean;
  reducedMotion: boolean;
}

const STORAGE_KEY = "docbel-accessibility";

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  textSize: "small",
  highContrast: false,
  simpleMode: false,
  reducedMotion: false,
};

function readStoredPreferences(): AccessibilityPreferences {
  if (typeof window === "undefined") return DEFAULT_ACCESSIBILITY_PREFERENCES;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as
      | Partial<AccessibilityPreferences>
      | null;
    if (!stored) return DEFAULT_ACCESSIBILITY_PREFERENCES;
    return {
      textSize:
        stored.textSize === "small" ||
        stored.textSize === "normal" ||
        stored.textSize === "large" ||
        stored.textSize === "xlarge"
          ? stored.textSize
          : "small",
      highContrast: stored.highContrast === true,
      simpleMode: stored.simpleMode === true,
      reducedMotion: stored.reducedMotion === true,
    };
  } catch {
    return DEFAULT_ACCESSIBILITY_PREFERENCES;
  }
}

let snapshot = readStoredPreferences();
const listeners = new Set<() => void>();

function applyToDocument(preferences: AccessibilityPreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.docbelTextSize = preferences.textSize;
  root.dataset.docbelContrast = preferences.highContrast ? "high" : "normal";
  root.dataset.docbelSimple = preferences.simpleMode ? "true" : "false";
  root.dataset.docbelMotion = preferences.reducedMotion ? "reduced" : "normal";
}

export function subscribeAccessibilityPreferences(listener: () => void) {
  listeners.add(listener);
  applyToDocument(snapshot);
  return () => listeners.delete(listener);
}

export function getAccessibilityPreferencesSnapshot() {
  return snapshot;
}

export function getAccessibilityPreferencesServerSnapshot() {
  return DEFAULT_ACCESSIBILITY_PREFERENCES;
}

export function updateAccessibilityPreferences(
  patch: Partial<AccessibilityPreferences>,
) {
  snapshot = { ...snapshot, ...patch };
  applyToDocument(snapshot);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Le parcours reste utilisable si le stockage navigateur est indisponible.
  }
  for (const listener of listeners) listener();
}
