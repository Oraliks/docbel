"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  Search,
  ChevronRight,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ORG_TYPE_LABELS } from "@/lib/formations/constants";
import type {
  AdminOrgRow,
  AdminOrgPermission,
} from "@/lib/formations/admin-queries";

type PermKey = keyof AdminOrgPermission;

interface PermMeta {
  key: PermKey;
  label: string;
  /** Capacité sensible : OFF par défaut, encadrée visuellement. */
  sensitive?: boolean;
}

const PERM_GROUPS: { title: string; perms: PermMeta[] }[] = [
  {
    title: "Création & soumission",
    perms: [
      { key: "canCreateTraining", label: "Créer des formations" },
      { key: "canSubmitTraining", label: "Soumettre à validation" },
      {
        key: "canPublishDirectly",
        label: "Publier sans validation",
        sensitive: true,
      },
    ],
  },
  {
    title: "Types de formation autorisés",
    perms: [
      { key: "canCreatePublicTraining", label: "Formations publiques" },
      { key: "canCreatePaidTraining", label: "Formations payantes" },
      {
        key: "canCreatePrivateTraining",
        label: "Formations privées",
        sensitive: true,
      },
      {
        key: "canCreateInternalTraining",
        label: "Formations internes",
        sensitive: true,
      },
    ],
  },
  {
    title: "Sessions & participants",
    perms: [
      { key: "canManageSessions", label: "Gérer les sessions" },
      { key: "canManageEnrollments", label: "Gérer les inscriptions" },
      { key: "canViewParticipantData", label: "Voir les données participants" },
      { key: "canExportParticipants", label: "Exporter les participants" },
      { key: "canIssueCertificate", label: "Délivrer des attestations" },
    ],
  },
  {
    title: "Distinctions Docbel",
    perms: [
      { key: "canUseDocbelBadge", label: "Utiliser le badge Docbel" },
      {
        key: "canRequestFeaturedPlacement",
        label: "Demander une mise en avant",
      },
    ],
  },
];

/** Défaut Prisma de la permission (pour une organisation sans permission posée). */
const DEFAULT_PERM: AdminOrgPermission = {
  canCreateTraining: true,
  canSubmitTraining: true,
  canPublishDirectly: false,
  canCreatePublicTraining: true,
  canCreatePaidTraining: true,
  canCreatePrivateTraining: false,
  canCreateInternalTraining: false,
  canManageSessions: true,
  canManageEnrollments: true,
  canViewParticipantData: true,
  canExportParticipants: false,
  canIssueCertificate: false,
  canUseDocbelBadge: false,
  canRequestFeaturedPlacement: false,
};

export function PermissionsClient({ orgs }: { orgs: AdminOrgRow[] }) {
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        (o.partnerOrganization?.toLowerCase().includes(q) ?? false),
    );
  }, [orgs, search]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Permissions des organisations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Capacités de création de formations octroyées à chaque organisation.
          </p>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        <ShieldAlert className="size-4 shrink-0 mt-0.5" />
        Les capacités sensibles (publication directe, formations privées et
        internes) sont <strong>désactivées par défaut</strong> — n'activez-les que
        pour des organisations de confiance.
      </p>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une organisation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucune organisation.
            </CardContent>
          </Card>
        )}
        {filtered.map((org) => (
          <OrgRow
            key={org.id}
            org={org}
            open={openId === org.id}
            onToggle={() => setOpenId((cur) => (cur === org.id ? null : org.id))}
          />
        ))}
      </div>
    </div>
  );
}

function OrgRow({
  org,
  open,
  onToggle,
}: {
  org: AdminOrgRow;
  open: boolean;
  onToggle: () => void;
}) {
  const [perm, setPerm] = useState<AdminOrgPermission>(
    org.permission ?? DEFAULT_PERM,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (key: PermKey, value: boolean) => {
    setPerm((p) => ({ ...p, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/formations/orgs/${org.id}/permissions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(perm),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Échec de l'enregistrement");
      toast.success(`Permissions de « ${org.name} » enregistrées.`);
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{org.name}</span>
            <Badge variant="outline" className="text-[10px]">
              {ORG_TYPE_LABELS[org.type as keyof typeof ORG_TYPE_LABELS] ??
                org.type}
            </Badge>
            {!org.permission && (
              <Badge variant="secondary" className="text-[10px]">
                Défauts
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {org.trainingsCount} formation{org.trainingsCount > 1 ? "s" : ""} ·{" "}
            {org.membersCount} membre{org.membersCount > 1 ? "s" : ""}
          </p>
        </div>
        <ChevronRight
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <CardContent className="border-t p-4 pt-4 flex flex-col gap-5">
          {PERM_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.perms.map((meta) => (
                  <label
                    key={meta.key}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                      meta.sensitive
                        ? "border-amber-300/70 dark:border-amber-900/70 bg-amber-50/40 dark:bg-amber-950/10"
                        : "border-border"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm">
                      {meta.label}
                      {meta.sensitive && (
                        <ShieldAlert className="size-3.5 text-amber-600" />
                      )}
                    </span>
                    <Switch
                      checked={perm[meta.key]}
                      onCheckedChange={(v) => update(meta.key, v)}
                      aria-label={meta.label}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-end gap-2 pt-1">
            {dirty && (
              <span className="text-xs text-muted-foreground">
                Modifications non enregistrées
              </span>
            )}
            <Button size="sm" onClick={save} disabled={!dirty || saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
