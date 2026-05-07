import { NextResponse } from "next/server";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";

/**
 * Endpoint public pour récupérer le texte des conditions générales (RGPD).
 * Utilisé par la modale dans le formulaire utilisateur.
 */
export async function GET() {
  const value = await getSetting(SETTING_KEYS.RGPD_GENERAL);
  return NextResponse.json({ value });
}
