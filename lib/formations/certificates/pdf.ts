/** Génération PDF d'une attestation/certificat (jsPDF, import dynamique). */
import "server-only";
import { CERTIFICATE_LABELS, type CertificateType } from "@/lib/formations/constants";

export interface CertificatePdfData {
  holderName: string;
  trainingTitle: string;
  orgName: string | null;
  type: string;
  certificateNumber: string;
  verificationCode: string;
  issuedAt: Date;
  durationLabel?: string | null;
  sessionLabel?: string | null;
  verifyUrl: string;
}

const VIOLET = "#7C3AED";
const INK = "#1f2937";
const MUTED = "#6b7280";

export async function buildCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Cadre
  doc.setDrawColor(VIOLET);
  doc.setLineWidth(1.4);
  doc.rect(10, 10, W - 20, H - 20);
  doc.setLineWidth(0.3);
  doc.rect(13, 13, W - 26, H - 26);

  // En-tête
  doc.setTextColor(VIOLET);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("DOCBEL — FORMATIONS", W / 2, 30, { align: "center" });

  doc.setTextColor(INK);
  doc.setFontSize(26);
  const typeLabel = CERTIFICATE_LABELS[data.type as CertificateType] ?? "Attestation";
  doc.text(typeLabel, W / 2, 48, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(MUTED);
  doc.text("Ce document atteste que", W / 2, 64, { align: "center" });

  // Titulaire
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(VIOLET);
  doc.text(data.holderName, W / 2, 78, { align: "center" });

  // Formation
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(MUTED);
  doc.text("a suivi la formation", W / 2, 92, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK);
  const titleLines = doc.splitTextToSize(data.trainingTitle, W - 80);
  doc.text(titleLines, W / 2, 104, { align: "center" });

  // Détails
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(MUTED);
  const details: string[] = [];
  if (data.orgName) details.push(`Organisme : ${data.orgName}`);
  if (data.durationLabel) details.push(`Durée : ${data.durationLabel}`);
  if (data.sessionLabel) details.push(`Session : ${data.sessionLabel}`);
  details.push(`Délivrée le ${data.issuedAt.toLocaleDateString("fr-BE")}`);
  doc.text(details.join("   ·   "), W / 2, 122, { align: "center" });

  // Pied : numéro + vérification
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(`N° ${data.certificateNumber}`, 20, H - 20);
  doc.text(`Vérifiez l'authenticité : ${data.verifyUrl}`, 20, H - 15);
  doc.setTextColor(VIOLET);
  doc.setFont("helvetica", "bold");
  doc.text(`Code : ${data.verificationCode}`, W - 20, H - 15, { align: "right" });

  const ab = doc.output("arraybuffer");
  return Buffer.from(ab);
}
