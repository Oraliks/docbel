"use client";

import { Fragment, type ReactNode } from "react";
import { InfoIcon, WalletCardsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";

const PAYMENT_FIELD_ORDER = new Map([
  ["modePaiement", 0],
  ["modePaiementChequeWarning", 1],
  ["iban", 2],
  ["titulaireCompte", 3],
  ["titulaireCompteNom", 4],
  ["bic", 5],
]);

interface PaymentMethodPanelProps {
  title: string;
  fields: PublicField[];
  renderField: (field: PublicField) => ReactNode;
}

/** Panneau horizontal dédié aux coordonnées de paiement du C1. */
export function PaymentMethodPanel({ title, fields, renderField }: PaymentMethodPanelProps) {
  const t = useTranslations("public.dossier");
  const orderedFields = fields.slice().sort((a, b) => {
    const aRank = PAYMENT_FIELD_ORDER.get(a.id) ?? 100 + (a.order ?? 0);
    const bRank = PAYMENT_FIELD_ORDER.get(b.id) ?? 100 + (b.order ?? 0);
    return aRank - bRank;
  });

  return (
    <Card className="rounded-3xl" data-docbel-readable>
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary" aria-hidden>
            <WalletCardsIcon className="size-5" />
          </span>
          <CardTitle>
            <h3>{title}</h3>
          </CardTitle>
        </div>
        <CardAction>
          <Badge variant="outline">
            <InfoIcon data-icon="inline-start" aria-hidden />
            {t("runnerPaymentChoiceEditable")}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-0 overflow-hidden rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)]">
          {orderedFields.map((field, index) => (
            <Fragment key={field.id}>
              {index > 0 && <Separator />}
              {renderField(field)}
            </Fragment>
          ))}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
