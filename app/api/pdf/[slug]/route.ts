import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toPublicForm } from "@/lib/pdf-forms/public-serializer";
import { isItsmeConfigured } from "@/lib/pdf-forms/integrations/itsme";
import { isDoccleConfigured } from "@/lib/pdf-forms/integrations/doccle";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET — définition publique d'un formulaire publié (vue sans données internes).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const form = await prisma.pdfForm.findUnique({ where: { slug } });
  if (!form || form.status !== "published") {
    return NextResponse.json({ error: "Formulaire indisponible" }, { status: 404, headers: json });
  }

  const pub = toPublicForm(form);
  // On n'expose les options de livraison/prefill que si réellement disponibles.
  return NextResponse.json(
    {
      ...pub,
      allowDoccle: pub.allowDoccle && isDoccleConfigured(),
      allowItsme: pub.allowItsme && isItsmeConfigured(),
    },
    { headers: json }
  );
}
