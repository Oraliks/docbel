import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

const BodySchema = z.object({
  email: z.string().email("Email invalide").max(200),
});

/// POST /api/bundles/runs/[runId]/email-code
///
/// Envoie le code de reprise du run à l'adresse email indiquée.
/// **Volontairement non-authentifié** (pas de comptes). La preuve de propriété
/// est le fait de connaître l'`id` du run (= clé interne, jamais exposée hors
/// session de création du dossier).
///
/// Rate-limit : 5 envois / 15 min / IP.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  // Rate limit
  const ip = getClientIp(req);
  const rl = checkRateLimit(`email-resume-code:${ip}`, {
    windowMs: 15 * 60_000,
    max: 5,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop d'envois — réessayez dans quelques minutes" },
      { status: 429 }
    );
  }

  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message || "Données invalides"
            : "Données invalides",
      },
      { status: 400 }
    );
  }

  const run = await prisma.bundleRun.findUnique({
    where: { id: runId },
    include: { bundle: { select: { name: true, slug: true } } },
  });

  if (!run || !run.resumeCode) {
    return NextResponse.json(
      { error: "Dossier introuvable" },
      { status: 404 }
    );
  }

  // Configuration Resend
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return NextResponse.json(
      { error: "Service email non configuré" },
      { status: 503 }
    );
  }

  const expiresAtText = run.resumeCodeExpiresAt
    ? run.resumeCodeExpiresAt.toLocaleDateString("fr-BE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "30 jours";

  const resend = new Resend(apiKey);
  try {
    const result = await resend.emails.send({
      from,
      to: parsed.email,
      subject: `[beldoc] Code de reprise pour votre dossier "${run.bundle.name}"`,
      text: [
        `Bonjour,`,
        ``,
        `Voici votre code de reprise pour le dossier en cours :`,
        ``,
        `    ${run.resumeCode}`,
        ``,
        `Pour reprendre votre dossier, rendez-vous sur la page :`,
        `https://beldoc.be/reprendre`,
        ``,
        `Et entrez le code ci-dessus.`,
        ``,
        `Ce code expire le ${expiresAtText}. Aucune donnée nominative n'est`,
        `liée à ce code — il vous donne uniquement accès à votre dossier en cours.`,
        ``,
        `Si vous ne reprenez pas le dossier avant cette date, toutes les données`,
        `saisies seront automatiquement supprimées. Conservez bien cet email.`,
        ``,
        `Cordialement,`,
        `L'équipe beldoc`,
      ].join("\n"),
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return NextResponse.json(
        { error: "Échec d'envoi de l'email" },
        { status: 502 }
      );
    }

    // Mémorise l'email (optionnel, pour rappel futur)
    await prisma.bundleRun.update({
      where: { id: runId },
      data: { resumeEmail: parsed.email },
    });

    return NextResponse.json({ ok: true, id: result.data?.id });
  } catch (err) {
    console.error("email-code error:", err);
    return NextResponse.json(
      { error: "Échec d'envoi de l'email" },
      { status: 502 }
    );
  }
}
