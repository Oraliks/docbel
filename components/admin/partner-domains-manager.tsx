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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ajouter un ou plusieurs domaines</CardTitle>
          <CardDescription>
            Saisissez les domaines sans le @ (ex : <code>cpas.brussels</code>).
            Pour rattacher plusieurs domaines à la même organisation (FGTB et
            ABVV par exemple), tapez-les sur des lignes différentes ou
            séparés par des virgules. Pour grouper avec une organisation
            existante, choisissez son nom dans la liste.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="domains">Domaine(s)</Label>
              <Textarea
                id="domains"
                placeholder={`fgtb.be\nabvv.be\n…`}
                rows={3}
                value={form.domains}
                onChange={(e) =>
                  setForm((f) => ({ ...f, domains: e.target.value }))
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Un domaine par ligne (ou séparés par virgule / espace). Les
                doublons sont ignorés.
              </p>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="organizationName">Organisation</Label>
              <Input
                id="organizationName"
                list="org-suggestions"
                placeholder="CPAS de Bruxelles"
                value={form.organizationName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, organizationName: e.target.value }))
                }
                required
              />
              <datalist id="org-suggestions">
                {orgNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Tapez un nom existant pour grouper avec, ou un nouveau pour
                créer une organisation.
              </p>
            </div>
            <div className="lg:col-span-2 space-y-1.5">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Input
                id="notes"
                placeholder="Contact, date d'autorisation, etc."
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-3 lg:col-span-2">
              <Switch
                id="isTest"
                checked={form.isTest}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, isTest: Boolean(v) }))
                }
              />
              <Label htmlFor="isTest" className="cursor-pointer">
                Domaine(s) de test
              </Label>
            </div>
            <div className="lg:col-span-2">
              <Button type="submit" disabled={isPending}>
                <PlusIcon className="size-4" />
                Ajouter
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Organisations enregistrées ({organizations.length})
          </CardTitle>
          <CardDescription>
            Cliquez sur une organisation pour voir ses domaines et utilisateurs
            inscrits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {organizations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune organisation enregistrée pour le moment.
            </p>
          ) : (
            organizations.map((org) => {
              const isOpen = !!expanded[org.organizationName];
              return (
                <div
                  key={org.organizationName}
                  className="rounded-lg border bg-card"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(org.organizationName)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
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
                  </button>

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
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {org.users.map((u) => (
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
                                    {new Date(u.createdAt).toLocaleDateString(
                                      "fr-BE",
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {u.lastLoginAt
                                      ? new Date(
                                          u.lastLoginAt,
                                        ).toLocaleDateString("fr-BE")
                                      : "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
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
    </div>
  );
}
