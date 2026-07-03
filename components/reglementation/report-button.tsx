"use client";

import { useState } from "react";
import { Flag, Check } from "lucide-react";

/**
 * « Signaler une erreur » sur un article. Ouvre un email pré-rempli vers l'admin
 * (adresse fournie côté serveur via CONTACT_EMAIL_FROM) ; si aucune adresse
 * n'est configurée, copie le signalement dans le presse-papier en repli.
 * Zéro base de données (la version persistée alimentant le tableau santé sera
 * un follow-up sous supervision).
 */
export function ReportButton({
  adminEmail,
  loi,
  articleNumber,
  label,
}: {
  adminEmail: string;
  loi: string;
  articleNumber: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  const onClick = () => {
    const url =
      typeof window !== "undefined" ? window.location.href.split("#")[0] : "";
    const subject = `[Réglementation] Signalement — ${loi} art. ${articleNumber}`;
    const body = [
      "Bonjour,",
      "",
      `Je signale un possible problème sur l'article : ${loi}, art. ${articleNumber}.`,
      `Lien : ${url}`,
      "",
      "Problème constaté :",
      "",
      "Merci.",
    ].join("\n");

    if (adminEmail) {
      window.location.href = `mailto:${adminEmail}?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(body)}`;
      return;
    }
    // Repli : copie du signalement.
    navigator.clipboard
      ?.writeText(`${subject}\n\n${body}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground print:hidden"
      title={label}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Flag className="size-4" aria-hidden />}
      {label}
    </button>
  );
}
