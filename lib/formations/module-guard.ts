/** Gardes d'activation du module pour pages & routes API. */
import "server-only";
import { NextResponse } from "next/server";
import { isFlagEnabled, type FormationsFlag } from "./module";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Renvoie une 404 si le flag (donc le module) est désactivé, sinon null. */
export async function blockIfFlagOff(flag: FormationsFlag): Promise<NextResponse | null> {
  if (await isFlagEnabled(flag)) return null;
  return NextResponse.json({ error: "Fonctionnalité indisponible" }, { status: 404, headers: json });
}
