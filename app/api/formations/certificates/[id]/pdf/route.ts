import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCertificate, buildPdfForCertificate } from "@/lib/formations/certificates/service";
import { formationOrgAccess } from "@/lib/formations/access";
import { trackEvent } from "@/lib/formations/analytics";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Télécharge le PDF d'une attestation (titulaire, organisation ou admin). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cert = await getCertificate(id);
  if (!cert) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const userId = session?.user?.id ?? null;
  if (!userId) return NextResponse.json({ error: "Connexion requise" }, { status: 401, headers: json });

  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const role = dbUser?.role ?? "user";

  let allowed = cert.userId === userId || role === "admin";
  if (!allowed) {
    const access = await formationOrgAccess(userId, role, cert.organizationId);
    allowed = access.role != null;
  }
  if (!allowed) return NextResponse.json({ error: "Accès refusé" }, { status: 403, headers: json });

  const pdf = await buildPdfForCertificate(id);
  if (!pdf) return NextResponse.json({ error: "Génération impossible" }, { status: 500, headers: json });

  await trackEvent("CERTIFICATE_DOWNLOADED", { trainingId: cert.trainingId, userId });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="attestation-${cert.certificateNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
