"use client";

import { useMemo, useState } from "react";
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
  label: string;
  description: string;
  icon: typeof Globe;
}[] = [
  {
    key: "publicEnabled",
    label: "Espace public",
    description: "Catalogue et pages visibles sans compte.",
    icon: Globe,
  },
  {
    key: "citizenEnabled",
    label: "Espace citoyen",
    description: "Accès depuis le tableau de bord citoyen.",
    icon: Users,
  },
  {
    key: "employerEnabled",
    label: "Espace employeur",
    description: "Formations dans l'espace employeur.",
    icon: Building2,
  },
  {
    key: "partnerEnabled",
    label: "Espace partenaire",
    description: "Formations dans l'espace partenaire.",
    icon: Handshake,
  },
];

const LAUNCH_MODES: { value: LaunchMode; label: string; helper: string }[] = [
  {
    value: "HIDDEN",
    label: "Masqué",
    helper: "Invisible partout (sauf admin). Aucune trace côté public.",
  },
  {
    value: "COMING_SOON",
    label: "Bientôt disponible",
    helper: "Teaser affiché dans la navigation, contenu non accessible.",
  },
  {
    value: "PRIVATE_BETA",
    label: "Bêta privée",
    helper: "Réservé aux pros (employeurs/partenaires) et aux admins.",
  },
  {
    value: "PUBLIC",
    label: "Public",
    helper: "Ouvert à tous selon les espaces activés ci-dessus.",
  },
];

const FLAG_LABELS: Record<FormationsFlag, string> = {
  catalog: "Catalogue",
  orientation: "Boussole",
  organizationCreation: "Création par organisation",
  privateTrainings: "Formations privées",
  internalTrainings: "Formations internes",
  enrollments: "Inscriptions",
  certificates: "Attestations",
  notifications: "Notifications",
  analytics: "Analytics",
  lms: "Mini-LMS",
  quizzes: "Quiz",
  paths: "Parcours",
  payments: "Paiement",
  marketplace: "Marketplace",
  ai: "IA orientation",
  partnerApi: "API partenaires",
  qualityScore: "Score qualité",
  docbelCertified: "Docbel Certified",
  sponsored: "Sponsorisé",
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
      if (!res.ok) throw new Error(data?.error || "Échec de l'enregistrement");
      const saved = data.module as FormationsModuleConfig;
      setBaseModule(saved);
      setModule(saved);
      toast.success("État du module enregistré.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de l'enregistrement",
      );
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
      if (!res.ok) throw new Error(data?.error || "Échec de l'enregistrement");
      const saved = data.flags as FormationsFlags;
      setBaseFlags(saved);
      setFlags(saved);
      toast.success("Feature flags enregistrés.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de l'enregistrement",
      );
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
              Module Formations
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Activation, espaces, maintenance et feature flags du module.
            </p>
          </div>
        </div>
        <Badge variant={module.enabled ? "success" : "secondary"}>
          {module.enabled ? "Activé" : "Désactivé"}
        </Badge>
      </div>

      {/* ===================== État du module ===================== */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Rocket className="size-4 text-primary" />
            État du module
          </CardTitle>
          <CardDescription>
            Active le module globalement et contrôle sa visibilité par espace.
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
                Module activé
              </Label>
              <p className="text-sm text-muted-foreground max-w-xl">
                Interrupteur principal du module Formations.
              </p>
              {!module.enabled && (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4 shrink-0" />
                  Le module est masqué partout, sauf dans l'administration.
                </p>
              )}
            </div>
            <Switch
              id="module-enabled"
              className="mt-1 scale-125 origin-right"
              checked={module.enabled}
              onCheckedChange={(v) => patchModule("enabled", v)}
              aria-label="Activer le module Formations"
            />
          </div>

          {/* Espaces */}
          <div className="grid gap-3 sm:grid-cols-2">
            {SPACE_TOGGLES.map(({ key, label, description, icon: Icon }) => (
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
                      {description}
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
            ))}
          </div>

          {/* Mode de lancement */}
          <div className="grid gap-2">
            <Label htmlFor="launch-mode" className="font-medium">
              Mode de lancement
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
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentMode && (
                <p className="text-xs text-muted-foreground sm:flex-1">
                  {currentMode.helper}
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
                    Mode maintenance
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Affiche un message au lieu du contenu (les admins gardent
                    l'accès).
                  </p>
                </div>
              </div>
              <Switch
                id="maintenance-mode"
                checked={module.maintenanceMode}
                onCheckedChange={(v) => patchModule("maintenanceMode", v)}
                aria-label="Mode maintenance"
              />
            </div>
            <div className="mt-3 grid gap-1.5">
              <Label
                htmlFor="maintenance-message"
                className="text-xs text-muted-foreground"
              >
                Message de maintenance
              </Label>
              <Textarea
                id="maintenance-message"
                value={module.maintenanceMessage}
                maxLength={2000}
                rows={2}
                onChange={(e) =>
                  patchModule("maintenanceMessage", e.target.value)
                }
                placeholder="Message affiché aux visiteurs pendant la maintenance…"
              />
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center justify-end gap-3">
            {moduleDirty && (
              <span className="text-xs text-muted-foreground">
                Modifications non enregistrées
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
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===================== Feature flags ===================== */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Feature flags</CardTitle>
          <CardDescription>
            Active les grandes fonctionnalités du module au fur et à mesure de
            leur développement.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FlagGroup
            title="Socle (V1)"
            keys={V1_FLAGS}
            flags={flags}
            disabled={!module.enabled}
            onToggle={(k, v) => setFlags((f) => ({ ...f, [k]: v }))}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Évolutions (V2 → V4)</h3>
              <Badge variant="outline" className="text-[0.7rem]">
                préparées
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Ces fonctionnalités sont préparées, activables quand développées.
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
              Les flags restent sans effet tant que le module est désactivé.
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            {flagsDirty && (
              <span className="text-xs text-muted-foreground">
                Modifications non enregistrées
              </span>
            )}
            <Button onClick={saveFlags} disabled={!flagsDirty || savingFlags}>
              {savingFlags ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Enregistrer les flags
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
  return (
    <div className="flex flex-col gap-2">
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {keys.map((key) => (
          <div
            key={key}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
              disabled && "opacity-60",
            )}
          >
            <Label htmlFor={`flag-${key}`} className="font-normal">
              {FLAG_LABELS[key]}
            </Label>
            <Switch
              id={`flag-${key}`}
              checked={flags[key]}
              onCheckedChange={(v) => onToggle(key, v)}
              disabled={disabled}
              aria-label={FLAG_LABELS[key]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
