"use server";

import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "./config";

/**
 * Server action : mémorise la langue choisie dans un cookie 1 an.
 * Appelée par le sélecteur de langue (client) ; le composant fait ensuite
 * router.refresh() pour re-rendre les server components dans la nouvelle langue.
 */
export async function setLocale(locale: string): Promise<void> {
  const value = isLocale(locale) ? locale : defaultLocale;
  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
