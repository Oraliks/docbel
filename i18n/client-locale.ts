import { isLocale, type Locale } from "./locales";
import { LOCALE_COOKIE } from "./config";

export const LOCALE_STORAGE_KEY = "beldoc.locale.chosen";

type LocaleChoiceResult = "changed" | "unchanged" | "failed";

type LocaleStorage = Pick<Storage, "setItem">;

type CommitLocaleChoiceOptions = {
  currentLocale?: Locale;
  persistLocale: (locale: Locale) => Promise<void>;
  getStorage?: () => LocaleStorage;
};

export function hasLocaleCookie(cookieHeader: string): boolean {
  return cookieHeader.split(";").some((part) => {
    const [name, ...rawValue] = part.trim().split("=");
    if (name !== LOCALE_COOKIE) return false;

    try {
      return isLocale(decodeURIComponent(rawValue.join("=")));
    } catch {
      return false;
    }
  });
}

/**
 * Persiste d'abord la source de vérité serveur (cookie), puis le marqueur local
 * facultatif. Un stockage navigateur bloqué ne doit jamais empêcher le choix.
 */
export async function commitLocaleChoice(
  locale: Locale,
  {
    currentLocale,
    persistLocale,
    getStorage = () => window.localStorage,
  }: CommitLocaleChoiceOptions,
): Promise<LocaleChoiceResult> {
  if (locale === currentLocale) return "unchanged";

  try {
    await persistLocale(locale);
  } catch {
    return "failed";
  }

  try {
    getStorage().setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Le cookie suffit ; localStorage est seulement un marqueur d'accueil.
  }

  return "changed";
}
