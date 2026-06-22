"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  GraduationCap,
  Globe,
  Users,
  Building2,
  Handshake,
  Wrench,
  Rocket,
  AlertTriangle,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FLAG_KEYS,
  type FormationsFlag,
  type FormationsFlags,
  type FormationsModuleConfig,
  type LaunchMode,
} from "@/lib/formations/module-types";

interface Props {
  initialModule: FormationsModuleConfig;
  initialFlags: FormationsFlags;
}

// --- Métadonnées d'affichage ----------------------------------------------

const SPACE_TOGGLES: {
  key: "publicEnabled" | "citizenEnabled" | "employerEnabled" | "partnerEnabled";
  labelKey: string;
  descriptionKey: string;
  icon: typeof Globe;
}[] = [
  {
    key: "publicEnabled",
    labelKey: "spacePublicLabel",
    descriptionKey: "spacePublicDescription",
    icon: Globe,
  },
  {
    key: "citizenEnabled",
    labelKey: "spaceCitizenLabel",
    descriptionKey: "spaceCitizenDescription",
    icon: Users,
  },
  {
    key: "employerEnabled",
    labelKey: "spaceEmployerLabel",
    descriptionKey: "spaceEmployerDescription",
    icon: Building2,
  },
  {
    key: "partnerEnabled",
    labelKey: "spacePartnerLabel",
    descriptionKey: "spacePartnerDescription",
    icon: Handshake,
  },
];

const LAUNCH_MODES: { value: LaunchMode; labelKey: string; helperKey: string }[] = [
  {
    value: "HIDDEN",
    labelKey: "launchHiddenLabel",
    helperKey: "launchHiddenHelper",
  },
  {
    value: "COMING_SOON",
    labelKey: "launchComingSoonLabel",
    helperKey: "launchComingSoonHelper",
  },
  {
    value: "PRIVATE_BETA",
    labelKey: "launchPrivateBetaLabel",
    helperKey: "launchPrivateBetaHelper",
  },
  {
    value: "PUBLIC",
    labelKey: "launchPublicLabel",
    helperKey: "launchPublicHelper",
  },
];

const FLAG_LABEL_KEYS: Record<FormationsFlag, string> = {
  catalog: "flagCatalog",
  orientation: "flagOrientation",
  organizationCreation: "flagOrganizationCreation",
  privateTrainings: "flagPrivateTrainings",
  internalTrainings: "flagInternalTrainings",
  enrollments: "flagEnrollments",
  certificates: "flagCertificates",
  notifications: "flagNotifications",
  analytics: "flagAnalytics",
  lms: "flagLms",
  quizzes: "flagQuizzes",
  paths: "flagPaths",
  payments: "flagPayments",
  marketplace: "flagMarketplace",
  ai: "flagAi",
  partnerApi: "flagPartnerApi",
  qualityScore: "flagQualityScore",
  docbelCertified: "flagDocbelCertified",
  sponsored: "flagSponsored",
};

// V1 = socle déjà développé ; le reste = préparé, activable quand développé.
const V1_FLAGS: FormationsFlag[] = [
  "catalog",
  "orientation",
  "organizationCreation",
  "privateTrainings",
  "internalTrainings",
  "enrollments",
  "certificates",
  "notifications",
  "analytics",
];
const FUTURE_FLAGS: FormationsFlag[] = FLAG_KEYS.filter(
  (k) => !V1_FLAGS.includes(k),
);

// --- Helpers --------------------------------------------------------------

/** Diff superficiel : ne renvoie que les champs qui diffèrent de la base. */
function diff<T extends object>(base: T, next: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (base[key] !== next[key]) out[key] = next[key];
  }
  return out;
}

export function ModuleSettingsClient({ initialModule, initialFlags }: Props) {
  const t = useTranslations("admin.formations");
  const [baseModule, setBaseModule] = useState(initialModule);
  const [module, setModule] = useState(initialModule);
  const [savingModule, setSavingModule] = useState(false);

  const [baseFlags, setBaseFlags] = useState(initialFlags);
  const [flags, setFlags] = useState(initialFlags);
  const [savingFlags, setSavingFlags] = useState(false);

  const moduleChanges = useMemo(
    () => diff(baseModule, module),
    [baseModule, module],
  );
  const flagChanges = useMemo(() => diff(baseFlags, flags), [baseFlags, flags]);
  const moduleDirty = Object.keys(moduleChanges).length > 0;
  const flagsDirty = Object.keys(flagChanges).length > 0;

  function patchModule<K extends keyof FormationsModuleConfig>(
    key: K,
    value: FormationsModuleConfig[K],
  ) {
    setModule((m) => ({ ...m, [key]: value }));
  }

  async function saveModule() {
    if (!moduleDirty || savingModule) return;
    setSavingModule(true);
    try {
      const res = await fetch("/api/admin/formations/module", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(moduleChanges),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("saveFailed"));
      const saved = data.module as FormationsModuleConfig;
      setBaseModule(saved);
      setModule(saved);
      toast.success(t("moduleStateSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSavingModule(false);
    }
  }

  async function saveFlags() {
    if (!flagsDirty || savingFlags) return;
    setSavingFlags(true);
    try {
      const res = await fetch("/api/admin/formations/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flagChanges),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("saveFailed"));
      const saved = data.flags as FormationsFlags;
      setBaseFlags(saved);
      setFlags(saved);
      toast.success(t("flagsSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSavingFlags(false);
    }
  }

  const currentMode = LAUNCH_MODES.find((m) => m.value === module.launchMode);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("moduleTitle")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("moduleSubtitle")}
            </p>
          </div>
        </div>
        <Badge variant={module.enabled ? "success" : "secondary"}>
          {module.enabled ? t("moduleEnabled") : t("moduleDisabled")}
        </Badge>
      </div>

      {/* ===================== État du module ===================== */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Rocket className="size-4 text-primary" />
            {t("moduleStateCardTitle")}
          </CardTitle>
          <CardDescription>
            {t("moduleStateCardDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Master switch */}
          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-xl border p-4 transition-colors",
              module.enabled
                ? "border-primary/30 bg-primary/5"
                : "border-amber-500/30 bg-amber-500/5",
            )}
          >
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="module-enabled"
                className="text-base font-semibold"
              >
                {t("moduleEnabledLabel")}
              </Label>
              <p className="text-sm text-muted-foreground max-w-xl">
                {t("moduleEnabledHelper")}
              </p>
              {!module.enabled && (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4 shrink-0" />
                  {t("moduleHiddenWarning")}
                </p>
              )}
            </div>
            <Switch
              id="module-enabled"
              className="mt-1 scale-125 origin-right"
              checked={module.enabled}
              onCheckedChange={(v) => patchModule("enabled", v)}
              aria-label={t("moduleEnabledAria")}
            />
          </div>

          {/* Espaces */}
          <div className="grid gap-3 sm:grid-cols-2">
            {SPACE_TOGGLES.map(({ key, labelKey, descriptionKey, icon: Icon }) => {
              const label = t(labelKey as Parameters<typeof t>[0]);
              return (
                <div
                  key={key}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg border p-3",
                    !module.enabled && "opacity-60",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <Label htmlFor={`space-${key}`} className="font-medium">
                        {label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t(descriptionKey as Parameters<typeof t>[0])}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id={`space-${key}`}
                    checked={module[key]}
                    onCheckedChange={(v) => patchModule(key, v)}
                    disabled={!module.enabled}
                    aria-label={label}
                  />
                </div>
              );
            })}
          </div>

          {/* Mode de lancement */}
          <div className="grid gap-2">
            <Label htmlFor="launch-mode" className="font-medium">
              {t("launchModeLabel")}
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={module.launchMode}
                onValueChange={(v) =>
                  patchModule("launchMode", v as LaunchMode)
                }
              >
                <SelectTrigger id="launch-mode" className="sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAUNCH_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {t(m.labelKey as Parameters<typeof t>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentMode && (
                <p className="text-xs text-muted-foreground sm:flex-1">
                  {t(currentMode.helperKey as Parameters<typeof t>[0])}
                </p>
              )}
            </div>
          </div>

          {/* Maintenance */}
          <div className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Wrench className="size-4" />
                </span>
                <div>
                  <Label htmlFor="maintenance-mode" className="font-medium">
                    {t("maintenanceModeLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("maintenanceModeHelper")}
                  </p>
                </div>
              </div>
              <Switch
                id="maintenance-mode"
                checked={module.maintenanceMode}
                onCheckedChange={(v) => patchModule("maintenanceMode", v)}
                aria-label={t("maintenanceModeLabel")}
              />
            </div>
            <div className="mt-3 grid gap-1.5">
              <Label
                htmlFor="maintenance-message"
                className="text-xs text-muted-foreground"
              >
                {t("maintenanceMessageLabel")}
              </Label>
              <Textarea
                id="maintenance-message"
                value={module.maintenanceMessage}
                maxLength={2000}
                rows={2}
                onChange={(e) =>
                  patchModule("maintenanceMessage", e.target.value)
                }
                placeholder={t("maintenanceMessagePlaceholder")}
              />
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center justify-end gap-3">
            {moduleDirty && (
              <span className="text-xs text-muted-foreground">
                {t("unsavedChanges")}
              </span>
            )}
            <Button
              onClick={saveModule}
              disabled={!moduleDirty || savingModule}
            >
              {savingModule ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===================== Feature flags ===================== */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{t("featureFlagsTitle")}</CardTitle>
          <CardDescription>
            {t("featureFlagsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FlagGroup
            title={t("flagGroupCore")}
            keys={V1_FLAGS}
            flags={flags}
            disabled={!module.enabled}
            onToggle={(k, v) => setFlags((f) => ({ ...f, [k]: v }))}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{t("flagGroupFuture")}</h3>
              <Badge variant="outline" className="text-[0.7rem]">
                {t("flagGroupFutureBadge")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              {t("flagGroupFutureHelper")}
            </p>
            <FlagGroup
              keys={FUTURE_FLAGS}
              flags={flags}
              disabled={!module.enabled}
              onToggle={(k, v) => setFlags((f) => ({ ...f, [k]: v }))}
            />
          </div>

          {!module.enabled && (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              {t("flagsDisabledWarning")}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            {flagsDirty && (
              <span className="text-xs text-muted-foreground">
                {t("unsavedChanges")}
              </span>
            )}
            <Button onClick={saveFlags} disabled={!flagsDirty || savingFlags}>
              {savingFlags ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {t("saveFlags")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Sous-composant : grille de flags -------------------------------------

function FlagGroup({
  title,
  keys,
  flags,
  disabled,
  onToggle,
}: {
  title?: string;
  keys: FormationsFlag[];
  flags: FormationsFlags;
  disabled: boolean;
  onToggle: (key: FormationsFlag, value: boolean) => void;
}) {
  const t = useTranslations("admin.formations");
  return (
    <div className="flex flex-col gap-2">
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {keys.map((key) => {
          const flagLabel = t(FLAG_LABEL_KEYS[key] as Parameters<typeof t>[0]);
          return (
            <div
              key={key}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                disabled && "opacity-60",
              )}
            >
              <Label htmlFor={`flag-${key}`} className="font-normal">
                {flagLabel}
              </Label>
              <Switch
                id={`flag-${key}`}
                checked={flags[key]}
                onCheckedChange={(v) => onToggle(key, v)}
                disabled={disabled}
                aria-label={flagLabel}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
