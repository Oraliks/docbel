import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { serializeBureau } from "@/lib/bureaus/types";
import { localizeRecord } from "@/lib/i18n/content";
import { getUserLocale } from "@/i18n/locale";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const bureau = await withDbRetry(() =>
      prisma.bureau.findUnique({
        where: { id },
        include: { organisme: true, commune: true },
      })
    );
    if (!bureau || !bureau.active) {
      return NextResponse.json(
        { error: "Bureau introuvable" },
        { status: 404, headers: jsonHeaders }
      );
    }

    const locale = await getUserLocale();
    let localized = await localizeRecord("Bureau", bureau, ["hoursNotes"], locale);
    if (localized.organisme) {
      localized = {
        ...localized,
        organisme: await localizeRecord(
          "Organisme",
          localized.organisme,
          ["name", "description"],
          locale
        ),
      };
    }

    return NextResponse.json(serializeBureau(localized), { headers: jsonHeaders });
  } catch (error) {
    console.error("[bureaus/:id] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500, headers: jsonHeaders }
    );
  }
}
