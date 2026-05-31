"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  Download,
  MailIcon,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PartnerOverviewStats } from "./partner-overview-stats";
import { PartnerOverviewFilters } from "./partner-overview-filters";
import { PartnerOverviewGrid } from "./partner-overview-grid";
import {
  PartnerCreateDialog,
  PartnerEditDomainDialog,
  PartnerRenameDialog,
  PartnerDeleteDomainDialog,
} from "./partner-overview-dialogs";
import type {
  OrganizationGroup,
  PartnerCounts,
  PartnerDomain,
  PartnerSegment,
  PartnerStatusFilter,
  PartnerUser,
} from "./types";

interface PartnerOverviewShellProps {
  initialOrganizations: OrganizationGroup[];
  existingOrganizationNames: string[];
  billingEnabled: boolean;
  /**
   * Personnalisation pour réutiliser le shell sur /admin/employeurs.
   * Valeurs par défaut = comportement historique de /admin/partenaires.
   */
  title?: string;
  /** Affiche le verrou de facturation (toggle GLOBAL → partenaires uniquement). */
  showBilling?: boolean;
  /** Segment pré-sélectionné dans le dialog de création d'entrée. */
  createDefaultSegment?: PartnerSegment;
  /**
   * Affiche le bouton d'export CSV. L'endpoint actuel ne sort que les
   * partenaires (role:"partner"), donc on le masque côté employeurs tant
   * qu'aucun export dédié n'existe.
   */
  showExport?: boolean;
  /** URL de l'export CSV des utilisateurs (partenaires par défaut). */
  exportHref?: string;
  /** Liens "page adjacente" du header (Statistiques, Email…). Défaut = liens partenaires. */
  headerLinks?: Array<{ href: string; label: string; icon: "stats" | "mail" }>;
}

/** Libellé affichable d'une entrée (email exact ou @domaine). */
function entryLabel(d: Pick<PartnerDomain, "kind" | "domain" | "email">): string {
  if (d.kind === "email") return d.email ?? "(email)";
  return d.domain ? `@${d.domain}` : "(domaine)";
}

/**
 * Orchestre l'état client de la page d'overview admin /admin/partenaires
 * (refonte 2026-05).
 *
 * Remplace `<PartnerDomainsManager />` (ancien composant monolithique de
 * ~1430 LOC qui mélangeait UI + fetch). On garde la logique métier
 * identique (mêmes endpoints API) mais éclatée :
 *   - shell ici : state global + handlers + dialogs (~280 LOC)
 *   - stats, filters, grid, card, details, dialogs : sous-composants
 *
 * Stratégie :
 *   - Données initiales injectées en SSR (server component parent fait
 *     `listOrganizations()` + sérialise).
 *   - Toutes les mutations sont optimistes côté client + reflètent côté
 *     server via les endpoints `/api/admin/partner-domains/*` et
 *     `/api/admin/partner-users/*`.
 *   - Pas de `router.refresh()` car l'UI est déjà à jour en local. Si
 *     l'admin recharge la page on relit depuis Prisma.
 *
 * Features préservées :
 *   - Création (multi-domaines, organisation)
 *   - Édition d'un domaine (rename, change org, notes, toggles)
 *   - Renommage d'organisation (avec fusion si nom existant)
 *   - Toggle actif/test par domaine
 *   - Suppression d'un domaine (avec confirmation)
 *   - Actions user (resend confirmation, activate, disable)
 *   - Export CSV utilisateurs
 *   - Lien email d'invitation
 *
 * Features non préservées :
 *   - Aucune ; tout est porté avec une UI plus compacte.
 */
export function PartnerOverviewShell({
  initialOrganizations,
  existingOrganizationNames,
  billingEnabled,
  title = "Partenaires",
  showBilling = true,
  createDefaultSegment = "partenaire",
  showExport = true,
  exportHref = "/api/admin/partner-users/export",
  headerLinks = [
    { href: "/admin/partenaires/stats", label: "Statistiques", icon: "stats" },
    { href: "/admin/partenaires/email", label: "Email d'invitation", icon: "mail" },
  ],
}: PartnerOverviewShellProps) {
  const [organizations, setOrganizations] =
    useState<OrganizationGroup[]>(initialOrganizations);
  const [orgNames, setOrgNames] = useState<string[]>(existingOrganizationNames);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [status, setStatus] = useState<PartnerStatusFilter>("all");
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    organizationName: string;
    domain: PartnerDomain;
  } | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartnerDomain | null>(null);

  // Verrou de facturation global (flag SETTING_KEYS.BILLING_ENABLED). Inerte
  // tant que le payant n'est pas branché — cf. lib/entitlements.ts.
  const [billing, setBilling] = useState(billingEnabled);
  const [billingSaving, setBillingSaving] = useState(false);

  const [isPending, startTransition] = useTransition();

  /* ---------------------------------------------------------------- */
  /*  Compteurs et filtrage                                            */
  /* ---------------------------------------------------------------- */

  const counts: PartnerCounts = useMemo(() => {
    const total = organizations.length;
    let active = 0;
    let inactive = 0;
    let pending = 0;

    for (const org of organizations) {
      if (org.isActive) active += 1;
      else inactive += 1;
      const hasPendingUser = org.users.some(
        (u) => u.status === "pending" || !u.emailVerified,
      );
      if (hasPendingUser) pending += 1;
    }

    return { total, active, inactive, pending };
  }, [organizations]);

  const testCount = useMemo(
    () => organizations.filter((o) => o.hasTestDomain).length,
    [organizations],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return organizations.filter((org) => {
      if (status === "active" && !org.isActive) return false;
      if (status === "inactive" && org.isActive) return false;
      if (
        status === "pending" &&
        !org.users.some((u) => u.status === "pending" || !u.emailVerified)
      )
        return false;
      if (status === "test" && !org.hasTestDomain) return false;

      if (!q) return true;
      if (org.organizationName.toLowerCase().includes(q)) return true;
      if (
        org.domains.some(
          (d) =>
            (d.domain?.includes(q) ?? false) ||
            (d.email?.toLowerCase().includes(q) ?? false),
        )
      )
        return true;
      if (
        org.users.some(
          (u) =>
            u.email.toLowerCase().includes(q) ||
            u.name.toLowerCase().includes(q),
        )
      )
        return true;
      return false;
    });
  }, [organizations, status, search]);

  /* ---------------------------------------------------------------- */
  /*  Helpers de mise à jour locale                                    */
  /* ---------------------------------------------------------------- */

  function upsertCreatedDomains(
    newDomains: Array<PartnerDomain & { organizationName: string }>,
  ) {
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
                isActive: o.isActive || newDomains.some((d) => d.isActive),
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
      setOrgNames((prev) =>
        [...prev, orgName].sort((a, b) => a.localeCompare(b)),
      );
    }
    setExpanded((prev) => ({ ...prev, [orgName]: true }));
  }

  function patchDomainLocally(
    organizationName: string,
    domainId: string,
    patch: Partial<PartnerDomain>,
  ) {
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
  }

  function removeDomainLocally(organizationName: string, domainId: string) {
    setOrganizations((prev) =>
      prev
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
        .filter((o) => o.domains.length > 0 || o.users.length > 0),
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Handlers domain actions                                          */
  /* ---------------------------------------------------------------- */

  function handleToggleActive(orgName: string, domain: PartnerDomain) {
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
        patchDomainLocally(orgName, domain.id, { isActive: next });
        toast.success(next ? "Domaine activé" : "Domaine désactivé");
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  }

  function handleToggleTest(orgName: string, domain: PartnerDomain) {
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
        patchDomainLocally(orgName, domain.id, { isTest: next });
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const org = organizations.find((o) =>
      o.domains.some((d) => d.id === target.id),
    );
    if (!org) {
      setDeleteTarget(null);
      return;
    }
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
        removeDomainLocally(org.organizationName, target.id);
        setDeleteTarget(null);
        toast.success(`Entrée ${entryLabel(target)} supprimée`);
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  }

  function handleSaveEdit(input: {
    kind: PartnerDomain["kind"];
    domain: string;
    email: string;
    segment: PartnerDomain["segment"];
    partnerType: string | null;
    organizationName: string;
    notes: string;
    isTest: boolean;
    isActive: boolean;
  }) {
    if (!editTarget) return;
    const target = editTarget;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/partner-domains/${target.domain.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Echec de la modification");
          return;
        }

        const updated = data.item as {
          id: string;
          kind: PartnerDomain["kind"];
          domain: string | null;
          email: string | null;
          segment: PartnerDomain["segment"];
          partnerType: string | null;
          notes: string | null;
          isTest: boolean;
          isActive: boolean;
          organizationName: string;
          createdAt: string | Date;
        };

        setOrganizations((prev) => {
          let next = [...prev];
          const orgChanged =
            updated.organizationName !== target.organizationName;
          if (orgChanged) {
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

            const movedDomain: PartnerDomain = {
              id: updated.id,
              kind: updated.kind,
              domain: updated.domain,
              email: updated.email,
              segment: updated.segment,
              partnerType: updated.partnerType,
              notes: updated.notes,
              isTest: updated.isTest,
              isActive: updated.isActive,
              createdAt: new Date(updated.createdAt).toISOString(),
            };
            const targetOrg = next.find(
              (o) => o.organizationName === updated.organizationName,
            );
            if (targetOrg) {
              targetOrg.domains.push(movedDomain);
              targetOrg.domainCount = targetOrg.domains.length;
              targetOrg.isActive = targetOrg.isActive || updated.isActive;
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
                      kind: updated.kind,
                      domain: updated.domain,
                      email: updated.email,
                      segment: updated.segment,
                      partnerType: updated.partnerType,
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
  }

  function handleRename(newName: string) {
    if (!renameTarget) return;
    const from = renameTarget;
    const to = newName.trim();
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
            const merged: OrganizationGroup = {
              ...toGroup,
              domains: [...toGroup.domains, ...fromGroup.domains],
              users: [...toGroup.users, ...fromGroup.users],
              domainCount: toGroup.domainCount + fromGroup.domainCount,
              userCount: toGroup.userCount + fromGroup.userCount,
              isActive: toGroup.isActive || fromGroup.isActive,
              hasTestDomain:
                toGroup.hasTestDomain || fromGroup.hasTestDomain,
            };
            return prev
              .filter(
                (o) =>
                  o.organizationName !== from &&
                  o.organizationName !== to,
              )
              .concat(merged);
          }

          return prev.map((o) =>
            o.organizationName === from
              ? { ...o, organizationName: to }
              : o,
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
  }

  /* ---------------------------------------------------------------- */
  /*  User actions                                                     */
  /* ---------------------------------------------------------------- */

  function handleResendUserConfirmation(user: PartnerUser) {
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
  }

  function handleActivateUser(user: PartnerUser) {
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
  }

  function handleSetUserStatus(user: PartnerUser, nextStatus: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/partner-users/${user.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set-status", status: nextStatus }),
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
              u.id === user.id ? { ...u, status: nextStatus } : u,
            ),
          })),
        );
        toast.success(`Statut mis à jour: ${nextStatus}`);
      } catch (err) {
        console.error(err);
        toast.error("Erreur réseau");
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Billing flag                                                     */
  /* ---------------------------------------------------------------- */

  function handleToggleBilling(next: boolean) {
    const prev = billing;
    setBilling(next); // optimiste
    setBillingSaving(true);
    startTransition(async () => {
      try {
        const res = await fetch(
          "/api/admin/settings/billing_enabled",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: next ? "true" : "false" }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setBilling(prev); // rollback
          toast.error(data?.error || "Echec de l'enregistrement");
          return;
        }
        toast.success(
          next ? "Verrou payant activé" : "Verrou payant désactivé",
        );
      } catch (err) {
        console.error(err);
        setBilling(prev);
        toast.error("Erreur réseau");
      } finally {
        setBillingSaving(false);
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /*  UI helpers                                                       */
  /* ---------------------------------------------------------------- */

  function resetFilters() {
    setStatus("all");
    setSearch("");
  }

  function toggleExpanded(orgName: string) {
    setExpanded((prev) => ({ ...prev, [orgName]: !prev[orgName] }));
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-6 lg:px-6">
      {/* En-tête ----------------------------------------------------- */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="size-5" />
          </span>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold leading-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {counts.total} organisation{counts.total > 1 ? "s" : ""} —
              gérez les domaines email autorisés et les utilisateurs inscrits.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerLinks.map((link) => (
            <Button
              key={link.href}
              render={<Link href={link.href} prefetch={false} />}
              variant="outline"
              size="sm"
            >
              {link.icon === "stats" ? (
                <BarChart3 className="size-4" />
              ) : (
                <MailIcon className="size-4" />
              )}
              {link.label}
            </Button>
          ))}
          {showExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = exportHref;
              }}
              title="Télécharger un CSV de tous les utilisateurs"
            >
              <Download className="size-4" />
              Export CSV
            </Button>
          )}
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Ajouter un domaine
          </Button>
        </div>
      </header>

      {/* Verrou de facturation (inerte pendant la beta) — toggle GLOBAL,
          affiché uniquement côté partenaires (showBilling). --------- */}
      {showBilling && (
        <Card size="sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="billing-enabled" className="cursor-pointer text-sm font-medium">
                Facturation / verrou payant — désactivé pendant la beta
              </Label>
              <p className="text-xs text-muted-foreground">
                Sans effet pour l&apos;instant : tant qu&apos;il est désactivé,
                tout membre d&apos;un segment accède aux outils de son segment. Le
                branchement du paiement (Mollie/Stripe) viendra plus tard.
              </p>
            </div>
            <Switch
              id="billing-enabled"
              checked={billing}
              disabled={billingSaving}
              onCheckedChange={handleToggleBilling}
            />
          </CardContent>
        </Card>
      )}

      {/* Stats + filtres + grille ---------------------------------- */}
      <PartnerOverviewStats counts={counts} />
      <PartnerOverviewFilters
        status={status}
        onStatusChange={setStatus}
        search={search}
        onSearchChange={setSearch}
        counts={counts}
        testCount={testCount}
      />
      <PartnerOverviewGrid
        organizations={filtered}
        expanded={expanded}
        onToggleExpanded={toggleExpanded}
        onRename={(orgName) => setRenameTarget(orgName)}
        onResetFilters={resetFilters}
        isPending={isPending}
        onEditDomain={(orgName, domain) =>
          setEditTarget({ organizationName: orgName, domain })
        }
        onToggleActive={handleToggleActive}
        onToggleTest={handleToggleTest}
        onDeleteDomain={setDeleteTarget}
        onResendUserConfirmation={handleResendUserConfirmation}
        onActivateUser={handleActivateUser}
        onSetUserStatus={handleSetUserStatus}
      />

      {/* Dialogs ----------------------------------------------------- */}
      <PartnerCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgNames={orgNames}
        isPending={isPending}
        defaultSegment={createDefaultSegment}
        onCreate={(created, errors) => {
          upsertCreatedDomains(created);
          if (errors.length > 0) {
            toast.warning(
              `${created.length} ajouté(s), ${errors.length} ignoré(s) : ${errors
                .map((e) => `${e.domain} (${e.error})`)
                .join(", ")}`,
            );
          } else if (created.length === 1) {
            toast.success(`Entrée ${entryLabel(created[0])} ajoutée`);
          } else {
            toast.success(
              `${created.length} entrées ajoutées à ${created[0].organizationName}`,
            );
          }
        }}
      />

      <PartnerEditDomainDialog
        target={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        orgNames={orgNames}
        isPending={isPending}
        onSave={handleSaveEdit}
      />

      <PartnerRenameDialog
        from={renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        isPending={isPending}
        onRename={handleRename}
      />

      <PartnerDeleteDomainDialog
        target={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        isPending={isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
