"use client";

import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { PartnerOverviewCard } from "./partner-overview-card";
import { PartnerOverviewDetails } from "./partner-overview-details";
import type {
  OrganizationGroup,
  PartnerDomain,
  PartnerUser,
} from "./types";

interface PartnerOverviewGridProps {
  organizations: OrganizationGroup[];
  expanded: Record<string, boolean>;
  onToggleExpanded: (orgName: string) => void;
  onRename: (orgName: string) => void;
  onResetFilters: () => void;
  isPending: boolean;
  onEditDomain: (orgName: string, domain: PartnerDomain) => void;
  onToggleActive: (orgName: string, domain: PartnerDomain) => void;
  onToggleTest: (orgName: string, domain: PartnerDomain) => void;
  onDeleteDomain: (domain: PartnerDomain) => void;
  onResendUserConfirmation: (user: PartnerUser) => void;
  onActivateUser: (user: PartnerUser) => void;
  onSetUserStatus: (user: PartnerUser, status: string) => void;
  onSetUserFlag: (
    user: PartnerUser,
    flag: "isOrgManager" | "canViewRdvHistory",
    value: boolean,
  ) => void;
}

/**
 * Grille (1 colonne) de cards d'organisations partenaires.
 *
 * Volontairement en 1 colonne car la card en mode expanded ouvre 2 tables
 * (domaines + utilisateurs) — sur 2 colonnes les tables seraient trop
 * étroites pour rester lisibles. On garde 1 col même sur desktop.
 *
 * Empty state si filtre actif → reset filters. Sinon message neutre
 * "aucune organisation".
 */
export function PartnerOverviewGrid({
  organizations,
  expanded,
  onToggleExpanded,
  onRename,
  onResetFilters,
  isPending,
  onEditDomain,
  onToggleActive,
  onToggleTest,
  onDeleteDomain,
  onResendUserConfirmation,
  onActivateUser,
  onSetUserStatus,
  onSetUserFlag,
}: PartnerOverviewGridProps) {
  const t = useTranslations("admin.partenaires");
  if (organizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <SearchX className="size-5" />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("emptyNoMatch")}
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="text-[12.5px] font-semibold text-primary underline-offset-2 hover:underline"
        >
          {t("resetFilters")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {organizations.map((org) => {
        const isExpanded = !!expanded[org.organizationName];
        return (
          <div
            key={org.organizationName}
            className="flex flex-col gap-2"
          >
            <PartnerOverviewCard
              org={org}
              isExpanded={isExpanded}
              onToggleExpanded={() => onToggleExpanded(org.organizationName)}
              onRename={() => onRename(org.organizationName)}
            />
            {isExpanded && (
              <PartnerOverviewDetails
                org={org}
                isPending={isPending}
                onEditDomain={(d) => onEditDomain(org.organizationName, d)}
                onToggleActive={(d) => onToggleActive(org.organizationName, d)}
                onToggleTest={(d) => onToggleTest(org.organizationName, d)}
                onDeleteDomain={onDeleteDomain}
                onResendUserConfirmation={onResendUserConfirmation}
                onActivateUser={onActivateUser}
                onSetUserStatus={onSetUserStatus}
                onSetUserFlag={onSetUserFlag}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
