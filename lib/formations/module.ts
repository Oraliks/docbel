/**
 * Docbel Formations — activation du module + feature flags.
 * Source de vérité : 2 clés JSON dans AppSetting (formations_module,
 * formations_flags) — réutilise le système de settings existant (pas de table
 * dédiée). Tout accès au module passe par getTrainingAccess() côté serveur ;
 * la navigation client lit l'état public via /api/formations/module-state.
 */
import "server-only";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/app-settings";
import { logActivity } from "@/lib/activity-logger";
import {
  DEFAULT_MODULE,
  DEFAULT_FLAGS,
  FLAG_KEYS,
  type FormationsFlag,
  type FormationsFlags,
  type FormationsModuleConfig,
  type LaunchMode,
} from "./module-types";

// Ré-export des types/constantes client-safe pour compat des imports serveur.
export {
  FLAG_KEYS,
  type FormationsFlag,
  type FormationsFlags,
  type FormationsModuleConfig,
  type LaunchMode,
};

function parseJson<T extends object>(raw: string, fallback: T): T {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? { ...fallback, ...v } : fallback;
  } catch {
    return fallback;
  }
}

export async function getFormationsModule(): Promise<FormationsModuleConfig> {
  return parseJson(await getSetting(SETTING_KEYS.FORMATIONS_MODULE), DEFAULT_MODULE);
}

export async function getFormationsFlags(): Promise<FormationsFlags> {
  return parseJson(await getSetting(SETTING_KEYS.FORMATIONS_FLAGS), DEFAULT_FLAGS);
}

export async function setFormationsModule(
  patch: Partial<FormationsModuleConfig>,
  userId: string,
): Promise<FormationsModuleConfig> {
  const current = await getFormationsModule();
  const next = { ...current, ...patch };
  await setSetting(SETTING_KEYS.FORMATIONS_MODULE, JSON.stringify(next), userId);
  await logActivity(userId, "updated", "setting", "formations_module", undefined, JSON.stringify(patch));
  return next;
}

export async function setFormationsFlags(
  patch: Partial<FormationsFlags>,
  userId: string,
): Promise<FormationsFlags> {
  const current = await getFormationsFlags();
  const next = { ...current, ...patch };
  await setSetting(SETTING_KEYS.FORMATIONS_FLAGS, JSON.stringify(next), userId);
  await logActivity(userId, "updated", "setting", "formations_flags", undefined, JSON.stringify(patch));
  return next;
}

// --- Accès ----------------------------------------------------------------

export type ModuleSpace = "public" | "citizen" | "employer" | "partner" | "admin";
export type ModuleAccess = "ok" | "hidden" | "maintenance" | "coming_soon" | "forbidden";

export interface ModuleViewer {
  isAdmin?: boolean;
  role?: string | null;
}

const isAdminViewer = (v: ModuleViewer) => v.isAdmin === true || v.role === "admin";
const isProViewer = (v: ModuleViewer) => v.role === "employer" || v.role === "partner" || isAdminViewer(v);

/**
 * Résout l'accès d'un viewer au module pour un espace donné. Renvoie l'état à
 * appliquer côté route (ok | hidden=404 | maintenance | coming_soon | forbidden).
 * L'admin garde toujours accès à l'espace admin.
 */
export async function getTrainingAccess(
  viewer: ModuleViewer = {},
  space: ModuleSpace = "public",
): Promise<{ access: ModuleAccess; config: FormationsModuleConfig }> {
  const config = await getFormationsModule();
  const admin = isAdminViewer(viewer);

  // L'admin accède toujours à son panneau (pour pouvoir réactiver le module).
  if (space === "admin" && admin) return { access: "ok", config };

  if (!config.enabled) return { access: admin ? "ok" : "hidden", config };
  if (config.maintenanceMode) return { access: admin ? "ok" : "maintenance", config };

  switch (config.launchMode) {
    case "HIDDEN":
      if (!admin) return { access: "hidden", config };
      break;
    case "COMING_SOON":
      if (!admin) return { access: "coming_soon", config };
      break;
    case "PRIVATE_BETA":
      if (!admin && !isProViewer(viewer)) return { access: "forbidden", config };
      break;
    case "PUBLIC":
    default:
      break;
  }

  // Activations par espace (l'admin passe outre).
  if (!admin) {
    if (space === "public" && !config.publicEnabled) return { access: "hidden", config };
    if (space === "citizen" && !config.citizenEnabled) return { access: "hidden", config };
    if (space === "employer" && !config.employerEnabled) return { access: "hidden", config };
    if (space === "partner" && !config.partnerEnabled) return { access: "hidden", config };
  }

  return { access: "ok", config };
}

export async function isTrainingModuleEnabled(): Promise<boolean> {
  return (await getFormationsModule()).enabled;
}

/** Le module est-il pleinement utilisable pour ce viewer/espace (état ok) ? */
export async function canAccessTrainingForSpace(
  viewer: ModuleViewer,
  space: ModuleSpace,
): Promise<boolean> {
  return (await getTrainingAccess(viewer, space)).access === "ok";
}

/** La nav doit-elle exposer Formations pour ce viewer/espace ? (ok ou teaser) */
export async function canShowTrainingNav(
  viewer: ModuleViewer,
  space: ModuleSpace,
): Promise<boolean> {
  const { access } = await getTrainingAccess(viewer, space);
  return access === "ok" || access === "coming_soon";
}

export async function canAccessTrainingAdmin(viewer: ModuleViewer): Promise<boolean> {
  return isAdminViewer(viewer);
}

/** Un feature flag est actif uniquement si le module est activé. */
export async function isFlagEnabled(flag: FormationsFlag): Promise<boolean> {
  const [config, flags] = await Promise.all([getFormationsModule(), getFormationsFlags()]);
  return config.enabled && !!flags[flag];
}

export async function getEnabledFlags(): Promise<FormationsFlags> {
  const [config, flags] = await Promise.all([getFormationsModule(), getFormationsFlags()]);
  if (!config.enabled) {
    return Object.fromEntries(FLAG_KEYS.map((k) => [k, false])) as FormationsFlags;
  }
  return flags;
}

/** État public sanitisé pour la nav client (aucune info sensible). */
export interface PublicModuleState {
  navVisible: boolean;
  access: ModuleAccess;
  maintenanceMessage: string | null;
  launchMode: LaunchMode;
}

export async function getPublicModuleState(viewer: ModuleViewer = {}): Promise<PublicModuleState> {
  const { access, config } = await getTrainingAccess(viewer, "public");
  return {
    navVisible: access === "ok" || access === "coming_soon",
    access,
    maintenanceMessage: access === "maintenance" ? config.maintenanceMessage : null,
    launchMode: config.launchMode,
  };
}
