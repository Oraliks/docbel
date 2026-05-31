import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { sendPartnerConfirmationEmail } from "@/lib/partner-confirmation";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const to = (body as { to?: string }).to?.trim().toLowerCase() ?? "";
  const segment =
    (body as { segment?: string }).segment === "employeur"
      ? "employeur"
      : "partenaire";
  if (!to || !EMAIL_REGEX.test(to)) {
    return NextResponse.json(
      { error: "Email destinataire invalide" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    process.env.BETTER_AUTH_URL ||
    new URL(req.url).origin;

  try {
    await sendPartnerConfirmationEmail({
      to,
      recipientName: authCheck.user.name || "Admin (test)",
      organizationName: "Organisation de test",
      confirmationUrl: `${baseUrl}/auth/confirm?token=PREVIEW_TOKEN_NON_FONCTIONNEL`,
      segment,
    });
    return NextResponse.json(
      {
        ok: true,
        message: `Email de test envoyé à ${to}`,
      },
      { headers: jsonHeaders },
    );
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Echec de l'envoi de l'email de test",
      },
      { status: 500, headers: jsonHeaders },
    );
  }
}
