import { createHash } from "crypto";

/// Calcule le SHA256 d'un buffer (PDF, payload, etc.).
export function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/// Convertit une data URL "data:image/png;base64,..." en Buffer.
/// Retourne null si le format est invalide.
export function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

/// Vérifie qu'une data URL est une image valide et raisonnable en taille.
/// Limite : 5 MB pour éviter les abus.
export function isValidSignatureDataUrl(dataUrl: string): boolean {
  if (!dataUrl.startsWith("data:image/")) return false;
  // Estimation taille décodée : longueur base64 * 3/4
  const base64Part = dataUrl.split(",")[1] || "";
  const estimatedBytes = (base64Part.length * 3) / 4;
  if (estimatedBytes > 5 * 1024 * 1024) return false;
  return true;
}

export interface SignatureAuditMetadata {
  signerName: string;
  signerEmail?: string | null;
  signerUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  signatureMethod: "drawn" | "typed" | "uploaded";
}

export interface SignatureAuditTrail extends SignatureAuditMetadata {
  signatureImageData: string; // data URL
  pdfHashBefore: string;
  pdfHashAfter: string;
  payloadHash: string;
}

/// Construit l'objet audit complet à persister dans SignatureRecord.
export function buildSignatureAuditTrail(input: {
  metadata: SignatureAuditMetadata;
  signatureDataUrl: string;
  pdfBefore: Buffer;
  pdfAfter: Buffer;
  payload: Record<string, unknown>;
}): SignatureAuditTrail {
  return {
    ...input.metadata,
    signatureImageData: input.signatureDataUrl,
    pdfHashBefore: sha256(input.pdfBefore),
    pdfHashAfter: sha256(input.pdfAfter),
    payloadHash: sha256(JSON.stringify(input.payload)),
  };
}
