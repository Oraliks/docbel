"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
  XCircleIcon,
  FlaskConicalIcon,
  PowerIcon,
  Building2Icon,
  UsersIcon,
  GlobeIcon,
  MailCheckIcon,
  MailWarningIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PencilIcon,
  MailIcon,
  ZapIcon,
  PauseIcon,
  SearchIcon,
  XIcon,
  DownloadIcon,
} from "lucide-react";

interface PartnerDomain {
  id: string;
  domain: string;
  notes: string | null;
  isTest: boolean;
  isActive: boolean;
  createdAt: string;
}

interface PartnerUser {
  id: string;
  name: string;
  email: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface OrganizationGroup {
  organizationName: string;
  domains: PartnerDomain[];
  users: PartnerUser[];
  isActive: boolean;
  hasTestDomain: boolean;
  domainCount: number;
  userCount: number;
}

interface PartnerDomainsManagerProps {
  initialOrganizations: OrganizationGroup[];
  existingOrganizationNames: string[];
}

export function PartnerDomainsManager({
  initialOrganizations,
  existingOrganizationNames,
}: PartnerDomainsManagerProps) {
  const [organizations, setOrganizations] =
    useState<OrganizationGroup[]>(initialOrganizations);
  const [orgNames, setOrgNames] = useState<string[]>(existingOrganizationNames);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<PartnerDomain | null>(null);
  const [editTarget, setEditTarget] = useState<{
    organizationName: string;
    domain: PartnerDomain;
  } | null>(null);
  const [editForm, setEditForm] = useState({
    domain: "",
    organizationName: "",
    notes: "",
    isTest: false,
    isActive: true,
  });
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<
    "all" | "active" | "inactive" | "test" | "with-users" | "no-users"
  >("all");
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    domains: "",
    organizationName: "",
    notes: "",
    isTest: false,
  });

  const refresh = (
    newDomains: Array<PartnerDomain & { organizationName: string }>,
  ) => {
    if (newDomains.length === 0) return;
    const orgName = newDomains[0].organizationName;

    setOrganizations((prev) => {
      const existing = prev.find((o) => o.organizationName === orgName);
      if (existing) {
        return prev.map((o) =>
          o.organizationName === orgName
            ? {
                ...o,
                domains: [...o.domains, ...newDomains],
                domainCount: o.domains.length + newDomains.length,
                isActive:
                  o.isActive || newDomains.some((d) => d.isActive),
                hasTestDomain:
                  o.hasTestDomain || newDomains.some((d) => d.isTest),
              }
            : o,
        );
      }
      return [
        {
          organizationName: orgName,
          domains: newDomains,
          users: [],
          isActive: newDomains.some((d) => d.isActive),
          hasTestDomain: newDomains.some((d) => d.isTest),
          domainCount: newDomains.length,
          userCount: 0,
        },
        ...prev,
      ];
    });
    if (!orgNames.includes(orgName)) {
      setOrgNames((prev) => [...prev, orgName].sort((a, b) => a.localeCompare(b)));
    }
    setExpanded((prev) => ({ ...prev, [orgName]: true }));
  };

  const updateDomainInOrg = (
    organizationName: string,
    domainId: string,
    patch: Partial<PartnerDomain>,
  ) => {
    setOrganizations((prev) =>
      prev.map((o) => {
        if (o.organizationName !== organizationName) return o;
        const domains = o.domains.map((d) =>
          d.id === domainId ? { ...d, ...patch } : d,
        );
        return {
          ...o,
          domains,
          isActive: domains.some((d) => d.isActive),
          hasTestDomain: domains.some((d) => d.isTest),
        };
      }),
    );
  };

  const removeDomainFromOrg = (
    organizationName: string,
    domainId: string,
  ) => {
    setOrganizations((prev) => {
      const next = prev
        .map((o) => {
          if (o.organizationName !== organizationName) return o;
          const domains = o.domains.filter((d) => d.id !== domainId);
          return {
            ...o,
            domains,
            domainCount: domains.length,
            isActive: domains.some((d) => d.isActive),
            hasTestDomain: domains.some((d) => d.isTest),
          };
        })
        .filter((o) => o.domains.length > 0 || o.users.length > 0);
      return next;
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedDomains = form.domains
      .split(/[\s,;]+/)
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter((d) => d.length > 0);

    if (parsedDomains.length === 0) {
      toast.error("Saisissez au moins un domaine");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/partner-domains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domains: parsedDomains,
            organizationName: form.organizationName,
            notes: form.notes,
            isTest: form.isTest,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Echec de l'ajout");
          return;
        }

        const created: Array<{
          id: string;
          domain: string;
          notes: string | null;
          isTest: boolean;
          isActive: boolean;
          createdAt: string;
          organizationName: string;
        }> = (data.items ?? [data.item]).map(
          (i: {
            id: string;
            domain: string;
            notes: string | null;
            isTest: boolean;
            isActive: boolean;
            createdAt: string | Date;
            organizationName: string;
          }) => ({
            id: i.id,
            domain: i.domain,
            notes: i.notes,
            isTest: i.isTest,
            isActive: i.isActive,
            createdAt: new Date(i.createdAt).toISOString(),
            organizationName: i.organizationName,
          }),
        );

        refresh(created);

        setForm({
          domains: "",
          organizationName: "",
          notes: "",
          isTest: false,
        });
        setCreateOpen(false);

        const errorList = (data.errors ?? []) as Array<{
          domain: string;
          error: string;
        }>;
        if (errorList.length > 0) {
          toast.warning(
            `${created.length} ajouté(s), ${errorList.length} ignoré(s) : ${errorList
              .map((e) => `${e.domain} (${e.error})`)
              .join(", ")}`,
          );
        } else {
          toast.success(
            created.length === 1
              ? `Domaine ${created[0].domain} ajouté`
              : `${created.length} domaines ajoutés à ${created[0].organizationName}`,
          );
        }
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  };

  const handleToggleActive = (
    organizationName: string,
    domain: PartnerDomain,
  ) => {
    startTransition(async () => {
      const next = !domain.isActive;
      try {
        const res = await fetch(`/api/admin/partner-domains/${domain.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: next }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Echec");
          return;
        }
        updateDomainInOrg(organizationName, domain.id, { isActive: next });
        toast.success(next ? "Domaine activé" : "Domaine désactivé");
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  };

  const handleToggleTest = (
    organizationName: string,
    domain: PartnerDomain,
  ) => {
    startTransition(async () => {
      const next = !domain.isTest;
      try {
        const res = await fetch(`/api/admin/partner-domains/${domain.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isTest: next }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Echec");
          return;
        }
        updateDomainInOrg(organizationName, domain.id, { isTest: next });
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const org = organizations.find((o) =>
      o.domains.some((d) => d.id === target.id),
    );
    if (!org) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/partner-domains/${target.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || "Echec de la suppression");
          return;
        }
        removeDomainFromOrg(org.organizationName, target.id);
        setDeleteTarget(null);
        toast.success(`Domaine ${target.domain} supprimé`);
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  };

  const toggleExpand = (orgName: string) => {
    setExpanded((prev) => ({ ...prev, [orgName]: !prev[orgName] }));
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredOrganizations = organizations.filter((org) => {
    if (filterMode === "active" && !org.isActive) return false;
    if (filterMode === "inactive" && org.isActive) return false;
    if (filterMode === "test" && !org.hasTestDomain) return false;
    if (filterMode === "with-users" && org.userCount === 0) return false;
    if (filterMode === "no-users" && org.userCount > 0) return false;

    if (!normalizedSearch) return true;
    if (org.organizationName.toLowerCase().includes(normalizedSearch))
      return true;
    if (org.domains.some((d) => d.domain.includes(normalizedSearch)))
      return true;
    if (
      org.users.some(
        (u) =>
          u.email.toLowerCase().includes(normalizedSearch) ||
          u.name.toLowerCase().includes(normalizedSearch),
      )
    )
      return true;
    return false;
  });

  const openEdit = (organizationName: string, domain: PartnerDomain) => {
    setEditTarget({ organizationName, domain });
    setEditForm({
      domain: domain.domain,
      organizationName,
      notes: domain.notes ?? "",
      isTest: domain.isTest,
      isActive: domain.isActive,
    });
  };

  const handleSaveEdit = () => {
    if (!editTarget) return;
    const target = editTarget;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/partner-domains/${target.domain.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              domain: editForm.domain,
              organizationName: editForm.organizationName,
              notes: editForm.notes,
              isTest: editForm.isTest,
              isActive: editForm.isActive,
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Echec de la modification");
          return;
        }

        const updated = data.item as {
          id: string;
          domain: string;
          notes: string | null;
          isTest: boolean;
          isActive: boolean;
          organizationName: string;
          createdAt: string | Date;
        };

        setOrganizations((prev) => {
          let next = [...prev];

          const removed = updated.organizationName !== target.organizationName;
          if (removed) {
            next = next
              .map((o) => {
                if (o.organizationName !== target.organizationName) return o;
                const domains = o.domains.filter(
                  (d) => d.id !== target.domain.id,
                );
                return {
                  ...o,
                  domains,
                  domainCount: domains.length,
                  isActive: domains.some((d) => d.isActive),
                  hasTestDomain: domains.some((d) => d.isTest),
                };
              })
              .filter((o) => o.domains.length > 0 || o.users.length > 0);

            const targetOrg = next.find(
              (o) => o.organizationName === updated.organizationName,
            );
            const movedDomain = {
              id: updated.id,
              domain: updated.domain,
              notes: updated.notes,
              isTest: updated.isTest,
              isActive: updated.isActive,
              createdAt: new Date(updated.createdAt).toISOString(),
            };
            if (targetOrg) {
              targetOrg.domains.push(movedDomain);
              targetOrg.domainCount = targetOrg.domains.length;
              targetOrg.isActive =
                targetOrg.isActive || updated.isActive;
              targetOrg.hasTestDomain =
                targetOrg.hasTestDomain || updated.isTest;
            } else {
              next.unshift({
                organizationName: updated.organizationName,
                domains: [movedDomain],
                users: [],
                isActive: updated.isActive,
                hasTestDomain: updated.isTest,
                domainCount: 1,
                userCount: 0,
              });
            }
          } else {
            next = next.map((o) => {
              if (o.organizationName !== target.organizationName) return o;
              const domains = o.domains.map((d) =>
                d.id === target.domain.id
                  ? {
                      ...d,
                      domain: updated.domain,
                      notes: updated.notes,
                      isTest: updated.isTest,
                      isActive: updated.isActive,
                    }
                  : d,
              );
              return {
                ...o,
                domains,
                isActive: domains.some((d) => d.isActive),
                hasTestDomain: domains.some((d) => d.isTest),
              };
            });
          }
          return next;
        });

        if (!orgNames.includes(updated.organizationName)) {
          setOrgNames((prev) =>
            [...prev, updated.organizationName].sort((a, b) =>
              a.localeCompare(b),
            ),
          );
        }
        setEditTarget(null);
        toast.success("Domaine mis à jour");
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  };

  const handleResendConfirmation = (user: PartnerUser) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/partner-users/${user.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "resend-confirmation" }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Echec");
          return;
        }
        toast.success(data.message || "Email renvoyé");
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  };

  const handleActivateUser = (user: PartnerUser) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/partner-users/${user.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "activate" }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Echec");
          return;
        }
        setOrganizations((prev) =>
          prev.map((o) => ({
            ...o,
            users: o.users.map((u) =>
              u.id === user.id
                ? { ...u, status: "active", emailVerified: true }
                : u,
            ),
          })),
        );
        toast.success(data.message || "Compte activé");
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  };

  const handleSetUserStatus = (user: PartnerUser, status: string) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/partner-users/${user.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set-status", status }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Echec");
          return;
        }
        setOrganizations((prev) =>
          prev.map((o) => ({
            ...o,
            users: o.users.map((u) =>
              u.id === user.id ? { ...u, status } : u,
            ),
          })),
        );
        toast.success(`Statut mis à jour: ${status}`);
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  };

  const openRename = (orgName: string) => {
    setRenameTarget(orgName);
    setRenameValue(orgName);
  };

  const handleRename = () => {
    if (!renameTarget) return;
    const from = renameTarget;
    const to = renameValue.trim();
    if (!to || to === from) {
      setRenameTarget(null);
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/partner-organizations/rename", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from, to }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Echec du renommage");
          return;
        }

        setOrganizations((prev) => {
          const fromGroup = prev.find((o) => o.organizationName === from);
          const toGroup = prev.find((o) => o.organizationName === to);
          if (!fromGroup) return prev;

          if (toGroup) {
            const merged = {
              ...toGroup,
              domains: [...toGroup.domains, ...fromGroup.domains],
              users: [...toGroup.users, ...fromGroup.users],
              domainCount: toGroup.domainCount + fromGroup.domainCount,
              userCount: toGroup.userCount + fromGroup.userCount,
              isActive: toGroup.isActive || fromGroup.isActive,
              hasTestDomain: toGroup.hasTestDomain || fromGroup.hasTestDomain,
            };
            return prev
              .filter(
                (o) =>
                  o.organizationName !== from && o.organizationName !== to,
              )
              .concat(merged);
          }

          return prev.map((o) =>
            o.organizationName === from ? { ...o, organizationName: to } : o,
          );
        });

        setOrgNames((prev) => {
          const next = prev.filter((n) => n !== from);
          if (!next.includes(to)) next.push(to);
          return next.sort((a, b) => a.localeCompare(b));
        });

        setExpanded((prev) => {
          const next: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(prev)) {
            next[k === from ? to : k] = v;
          }
          return next;
        });

        setRenameTarget(null);
        toast.success(
          `Renommé "${from}" → "${to}" (${data.domainsUpdated} domaine${
            data.domainsUpdated > 1 ? "s" : ""
          }, ${data.usersUpdated} utilisateur${
            data.usersUpdated > 1 ? "s" : ""
          })`,
        );
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                Organisations enregistrées ({filteredOrganizations.length}
                {filteredOrganizations.length !== organizations.length
                  ? ` / ${organizations.length}`
                  : ""}
                )
              </CardTitle>
              <CardDescription>
                Cliquez sur une organisation pour voir ses domaines et
                utilisateurs inscrits.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = "/api/admin/partner-users/export";
                }}
                title="Télécharger un CSV de tous les utilisateurs partenaires"
              >
                <DownloadIcon className="size-4" />
                Export CSV
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-4" />
                Ajouter un domaine
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom d'organisation, domaine ou email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                  title="Effacer"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>
            <select
              value={filterMode}
              onChange={(e) =>
                setFilterMode(
                  e.target.value as
                    | "all"
                    | "active"
                    | "inactive"
                    | "test"
                    | "with-users"
                    | "no-users",
                )
              }
              className="rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted"
            >
              <option value="all">Toutes les organisations</option>
              <option value="active">Actives uniquement</option>
              <option value="inactive">Inactives uniquement</option>
              <option value="test">Avec domaine de test</option>
              <option value="with-users">Avec utilisateurs</option>
              <option value="no-users">Sans utilisateur</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredOrganizations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {organizations.length === 0
                ? "Aucune organisation enregistrée pour le moment."
                : "Aucune organisation ne correspond à votre recherche."}
            </p>
          ) : (
            filteredOrganizations.map((org) => {
              const isOpen = !!expanded[org.organizationName];
              return (
                <div
                  key={org.organizationName}
                  className="rounded-lg border bg-card"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(org.organizationName)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleExpand(org.organizationName);
                      }
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    {isOpen ? (
                      <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      <Building2Icon className="size-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {org.organizationName}
                        </span>
                        {org.isActive ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
                          >
                            <CheckCircle2Icon className="size-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <XCircleIcon className="size-3" />
                            Inactive
                          </Badge>
                        )}
                        {org.hasTestDomain && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                          >
                            <FlaskConicalIcon className="size-3" />
                            Test
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <GlobeIcon className="size-3" />
                          {org.domainCount} domaine
                          {org.domainCount > 1 ? "s" : ""}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UsersIcon className="size-3" />
                          {org.userCount} utilisateur
                          {org.userCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRename(org.organizationName);
                      }}
                      disabled={isPending}
                      title="Renommer l'organisation"
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="space-y-4 border-t bg-muted/20 p-4">
                      <section>
                        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <GlobeIcon className="size-3.5" />
                          Domaines ({org.domains.length})
                        </h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Domaine</TableHead>
                              <TableHead>Notes</TableHead>
                              <TableHead>Statut</TableHead>
                              <TableHead className="text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {org.domains.map((d) => (
                              <TableRow key={d.id}>
                                <TableCell className="font-mono text-sm">
                                  @{d.domain}
                                </TableCell>
                                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                                  {d.notes || "—"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {d.isActive ? (
                                      <Badge
                                        variant="outline"
                                        className="gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
                                      >
                                        <CheckCircle2Icon className="size-3" />
                                        Actif
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="gap-1">
                                        <XCircleIcon className="size-3" />
                                        Désactivé
                                      </Badge>
                                    )}
                                    {d.isTest && (
                                      <Badge
                                        variant="outline"
                                        className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                                      >
                                        <FlaskConicalIcon className="size-3" />
                                        Test
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        openEdit(org.organizationName, d)
                                      }
                                      disabled={isPending}
                                      title="Modifier"
                                    >
                                      <PencilIcon className="size-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        handleToggleActive(
                                          org.organizationName,
                                          d,
                                        )
                                      }
                                      disabled={isPending}
                                      title={
                                        d.isActive ? "Désactiver" : "Activer"
                                      }
                                    >
                                      <PowerIcon className="size-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        handleToggleTest(
                                          org.organizationName,
                                          d,
                                        )
                                      }
                                      disabled={isPending}
                                      title={
                                        d.isTest
                                          ? "Retirer le marquage test"
                                          : "Marquer comme test"
                                      }
                                    >
                                      <FlaskConicalIcon className="size-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeleteTarget(d)}
                                      disabled={isPending}
                                      className="text-destructive hover:text-destructive"
                                      title="Supprimer"
                                    >
                                      <Trash2Icon className="size-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </section>

                      <section>
                        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <UsersIcon className="size-3.5" />
                          Utilisateurs inscrits ({org.users.length})
                        </h3>
                        {org.users.length === 0 ? (
                          <p className="rounded-md border border-dashed bg-background p-4 text-center text-xs text-muted-foreground">
                            Aucun utilisateur inscrit pour cette organisation.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead>Inscrit le</TableHead>
                                <TableHead>Dernière connexion</TableHead>
                                <TableHead className="text-right">
                                  Actions
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {org.users.map((u) => {
                                const isPendingUser =
                                  u.status === "pending" || !u.emailVerified;
                                const isDisabled =
                                  u.status === "disabled" ||
                                  u.status === "locked";
                                return (
                                  <TableRow key={u.id}>
                                    <TableCell className="font-medium">
                                      {u.name}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                      {u.email}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <Badge
                                          variant="outline"
                                          className={
                                            u.status === "active"
                                              ? "gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
                                              : "gap-1"
                                          }
                                        >
                                          {u.status}
                                        </Badge>
                                        {u.emailVerified ? (
                                          <Badge
                                            variant="outline"
                                            className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                                          >
                                            <MailCheckIcon className="size-3" />
                                            Vérifié
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant="outline"
                                            className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                                          >
                                            <MailWarningIcon className="size-3" />
                                            En attente
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {new Date(
                                        u.createdAt,
                                      ).toLocaleDateString("fr-BE")}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {u.lastLoginAt
                                        ? new Date(
                                            u.lastLoginAt,
                                          ).toLocaleDateString("fr-BE")
                                        : "—"}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex justify-end gap-1">
                                        {isPendingUser && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              handleResendConfirmation(u)
                                            }
                                            disabled={isPending}
                                            title="Renvoyer l'email de confirmation"
                                          >
                                            <MailIcon className="size-4" />
                                          </Button>
                                        )}
                                        {(isPendingUser || isDisabled) && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              handleActivateUser(u)
                                            }
                                            disabled={isPending}
                                            title="Activer le compte"
                                            className="text-emerald-600 hover:text-emerald-700"
                                          >
                                            <ZapIcon className="size-4" />
                                          </Button>
                                        )}
                                        {u.status === "active" && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              handleSetUserStatus(
                                                u,
                                                "disabled",
                                              )
                                            }
                                            disabled={isPending}
                                            title="Désactiver le compte"
                                            className="text-amber-600 hover:text-amber-700"
                                          >
                                            <PauseIcon className="size-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </section>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setForm({
              domains: "",
              organizationName: "",
              notes: "",
              isTest: false,
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un ou plusieurs domaines</DialogTitle>
            <DialogDescription>
              Saisissez les domaines sans le @ (ex : <code>cpas.brussels</code>).
              Pour rattacher plusieurs domaines à la même organisation (FGTB
              et ABVV par exemple), tapez-les sur des lignes différentes ou
              séparés par des virgules.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-domains">Domaine(s)</Label>
              <Textarea
                id="create-domains"
                placeholder={`fgtb.be\nabvv.be\n…`}
                rows={3}
                value={form.domains}
                onChange={(e) =>
                  setForm((f) => ({ ...f, domains: e.target.value }))
                }
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Un domaine par ligne (ou séparés par virgule / espace). Les
                doublons sont ignorés.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-organizationName">Organisation</Label>
              <Input
                id="create-organizationName"
                list="org-suggestions-create"
                placeholder="CPAS de Bruxelles"
                value={form.organizationName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, organizationName: e.target.value }))
                }
                required
              />
              <datalist id="org-suggestions-create">
                {orgNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Tapez un nom existant pour grouper avec, ou un nouveau pour
                créer une organisation.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-notes">Notes (optionnel)</Label>
              <Input
                id="create-notes"
                placeholder="Contact, date d'autorisation, etc."
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="create-isTest"
                checked={form.isTest}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, isTest: Boolean(v) }))
                }
              />
              <Label htmlFor="create-isTest" className="cursor-pointer">
                Domaine(s) de test
              </Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                <PlusIcon className="size-4" />
                {isPending ? "Ajout…" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce domaine ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le domaine <strong>@{deleteTarget?.domain}</strong> sera
              définitivement retiré. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le domaine</DialogTitle>
            <DialogDescription>
              Vous pouvez aussi déplacer ce domaine vers une autre organisation
              en changeant son nom.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-domain">Domaine</Label>
              <Input
                id="edit-domain"
                value={editForm.domain}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, domain: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-org">Organisation</Label>
              <Input
                id="edit-org"
                list="org-suggestions-edit"
                value={editForm.organizationName}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    organizationName: e.target.value,
                  }))
                }
              />
              <datalist id="org-suggestions-edit">
                {orgNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Input
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-isActive"
                  checked={editForm.isActive}
                  onCheckedChange={(v) =>
                    setEditForm((f) => ({ ...f, isActive: Boolean(v) }))
                  }
                />
                <Label htmlFor="edit-isActive" className="cursor-pointer">
                  Actif
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-isTest"
                  checked={editForm.isTest}
                  onCheckedChange={(v) =>
                    setEditForm((f) => ({ ...f, isTest: Boolean(v) }))
                  }
                />
                <Label htmlFor="edit-isTest" className="cursor-pointer">
                  Test
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer l&apos;organisation</DialogTitle>
            <DialogDescription>
              Le nouveau nom sera appliqué en cascade à tous les domaines et
              tous les utilisateurs de l&apos;organisation. Si le nouveau nom
              correspond à une organisation existante, les deux fusionneront.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rename-from">Nom actuel</Label>
              <Input
                id="rename-from"
                value={renameTarget ?? ""}
                disabled
                readOnly
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rename-to">Nouveau nom</Label>
              <Input
                id="rename-to"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameTarget(null)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button onClick={handleRename} disabled={isPending}>
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
