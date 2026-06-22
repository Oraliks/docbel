"use client";

import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  History,
  AlertTriangle,
} from "lucide-react";
import { IMPERSONATION_READ_ONLY_REASON } from "../use-impersonation-read-only";
import type { SerializedBureau, BureauTypeCode } from "@/lib/bureaus/types";
import { displayBureauName } from "@/lib/bureaus/format";

// Couleurs locales : la table est self-contained pour le rendu
// d'une ligne, le parent n'a pas à passer ces constantes en prop.
const TYPE_COLORS: Record<BureauTypeCode, string> = {
  CPAS: "#5E3A8E",
  COMMUNE: "#2E7D32",
  ONEM: "#0050A0",
  SYNDICAT: "#E30613",
  PERMANENCE: "#D4A017",
  AUTRE: "#6B7280",
};

type Props = {
  items: SerializedBureau[];
  loading: boolean;
  onEdit: (bureau: SerializedBureau) => void;
  onDelete: (bureau: SerializedBureau) => void;
  onToggleVerify: (bureau: SerializedBureau) => void;
  onShowRevisions: (bureau: SerializedBureau) => void;
  /// Si true, les actions mutantes (Modifier / Désactiver / Toggle vérif)
  /// sont rendues mais désactivées. L'historique reste cliquable car c'est
  /// une lecture. Passé par `BureausManager` qui possède l'instance du hook.
  readOnly?: boolean;
};

export function BureauxTable({
  items,
  loading,
  onEdit,
  onDelete,
  onToggleVerify,
  onShowRevisions,
  readOnly = false,
}: Props) {
  const t = useTranslations("admin.bureaux");

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        {t("tableEmpty")}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("colName")}</TableHead>
          <TableHead>{t("colType")}</TableHead>
          <TableHead>{t("colLocation")}</TableHead>
          <TableHead>{t("colCommune")}</TableHead>
          <TableHead>{t("colStatus")}</TableHead>
          <TableHead>{t("colVerif")}</TableHead>
          <TableHead className="text-right">{t("colActions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((b) => (
          <TableRow key={b.id}>
            <TableCell>
              {/* displayBureauName : "BRUXELLES" → "ONEM de Bruxelles"
                  pour les bureaux ONEM, cohérent avec le front public. */}
              <div className="font-medium">{displayBureauName(b)}</div>
              {b.organismeName && (
                <div className="text-xs text-muted-foreground">{b.organismeName}</div>
              )}
            </TableCell>
            <TableCell>
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: TYPE_COLORS[b.type] + "20",
                  color: TYPE_COLORS[b.type],
                  borderColor: TYPE_COLORS[b.type] + "40",
                }}
              >
                {t(`typeShort${b.type}` as Parameters<typeof t>[0])}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                {b.postalCode} {b.city}
              </div>
              <div className="text-xs text-muted-foreground">
                {b.street}
                {b.streetNum ? ` ${b.streetNum}` : ""}
              </div>
            </TableCell>
            <TableCell>
              {b.communeName ? (
                <span className="text-sm">{b.communeName}</span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              {b.active ? (
                <Badge variant="outline" className="border-green-500 text-green-700">
                  {t("statusActive")}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-gray-400 text-gray-500">
                  {t("statusInactive")}
                </Badge>
              )}
            </TableCell>
            <TableCell>
              <VerifyBadge bureau={b} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggleVerify(b)}
                  disabled={readOnly}
                  title={
                    readOnly
                      ? IMPERSONATION_READ_ONLY_REASON
                      : b.verified
                        ? t("unverifyTitle")
                        : t("verifyTitle")
                  }
                >
                  {b.verified ? (
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onShowRevisions(b)}
                  title={t("historyTitle")}
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(b)}
                  disabled={readOnly}
                  title={readOnly ? IMPERSONATION_READ_ONLY_REASON : t("editTitle")}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(b)}
                  disabled={readOnly}
                  title={readOnly ? IMPERSONATION_READ_ONLY_REASON : t("disableTitle")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Badge "vérifié" / "à revérifier" basé sur l'âge de lastVerifiedAt.
// Local à la table puisque c'est son seul lieu d'usage.
function VerifyBadge({ bureau }: { bureau: SerializedBureau }) {
  const t = useTranslations("admin.bureaux");
  if (!bureau.verified) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const lastVerified = bureau.lastVerifiedAt ? new Date(bureau.lastVerifiedAt) : null;
  if (!lastVerified) {
    return (
      <Badge variant="outline" className="border-green-500 text-green-700">
        <ShieldCheck className="h-3 w-3 mr-1" /> {t("verified")}
      </Badge>
    );
  }
  const ageMs = Date.now() - lastVerified.getTime();
  const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000);
  const isStale = ageMonths > 6;
  return (
    <div className="flex flex-col gap-0.5">
      <Badge
        variant="outline"
        className={
          isStale ? "border-amber-500 text-amber-700" : "border-green-500 text-green-700"
        }
      >
        {isStale ? (
          <AlertTriangle className="h-3 w-3 mr-1" />
        ) : (
          <ShieldCheck className="h-3 w-3 mr-1" />
        )}
        {isStale ? t("toReverify") : t("verified")}
      </Badge>
      <span className="text-[10px] text-muted-foreground">
        {t("monthsAgo", { count: Math.round(ageMonths) })}
      </span>
    </div>
  );
}
