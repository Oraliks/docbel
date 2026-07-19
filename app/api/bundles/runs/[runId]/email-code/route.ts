import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { normalizeResumeCode } from "@/lib/bundles/resume-code";
import { hashResumeCode } from "@/lib/bundles/resume-code-hash";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";

// Même mécanisme que lib/booking/emails.ts et lib/formations/emails.ts : pas
// de nouvel env, on réutilise l'URL publique de l'app (déjà documentée README).
const APP_URL =
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || "https://docbel.be";

const BodySchema = z.object({
  email: z.string().email("Email invalide").max(200),
  // Le code en CLAIR est fourni par le client (qui le détient à la création) :
  // on ne le stocke plus en base, on ne peut donc plus le « relire » pour
  // l'envoyer. On vérifie qu'il correspond bien au run via son hash.
  code: z.string().min(8).max(40),
});

/// POST /api/bundles/runs/[runId]/email-code
///
/// Envoie PAR EMAIL le code de reprise — uniquement à la CRÉATION (le client
/// fournit le code en clair qu'il vient de recevoir). Le code n'étant stocké
/// que sous forme de hash, il ne peut plus être renvoyé après coup.
/// **Volontairement non-authentifié** (le couple runId + code fait preuve).
///
/// Rate-limit : 5 envois / 15 min / IP.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

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

  const code = normalizeResumeCode(parsed.code);

  const run = await prisma.bundleRun.findUnique({
    where: { id: runId },
    include: { bundle: { select: { name: true, slug: true } } },
  });

  if (!run) {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
  }

  // Le code fourni doit correspondre à ce run (hash, ou legacy clair).
  const matches =
    (run.resumeCodeHash && run.resumeCodeHash === hashResumeCode(code)) ||
    (run.resumeCode && run.resumeCode === code);
  if (!matches) {
    return NextResponse.json(
      { error: "Le code ne correspond pas à ce dossier." },
      { status: 400 },
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
        `    ${code}`,
        ``,
        `Pour reprendre votre dossier, rendez-vous sur la page :`,
        `${APP_URL}/reprendre`,
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
