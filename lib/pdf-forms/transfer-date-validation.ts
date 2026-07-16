/** Règles de date pour un transfert d'organisme de paiement. */
export type TransferDateValidationInput = {
  effectiveDate: string | null | undefined;
  today: string;
  isRevisionOrRegularisation?: boolean;
};

export type TransferDateValidation =
  | { ok: true; kind: "today-or-future" | "past-allowed"; message?: string }
  | { ok: false; kind: "missing" | "invalid" | "past-not-allowed"; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateTransferDate({ effectiveDate, today, isRevisionOrRegularisation = false }: TransferDateValidationInput): TransferDateValidation {
  if (!effectiveDate) return { ok: false, kind: "missing", message: "Indique la date souhaitée pour le transfert." };
  if (!isRealIsoDate(effectiveDate) || !isRealIsoDate(today)) {
    return { ok: false, kind: "invalid", message: "La date du transfert doit être une date valide (JJ/MM/AAAA)." };
  }
  if (effectiveDate < today) {
    if (isRevisionOrRegularisation) {
      return { ok: true, kind: "past-allowed", message: "Cette date est antérieure à aujourd'hui : elle reste possible pour une révision ou une régularisation." };
    }
    return { ok: false, kind: "past-not-allowed", message: "Pour une nouvelle demande de transfert, la date ne peut pas être antérieure à aujourd'hui. Pour corriger une situation passée, choisissez une révision ou une régularisation." };
  }
  return { ok: true, kind: "today-or-future" };
}
