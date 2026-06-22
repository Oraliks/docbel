// Typage strict des clés next-intl.
//
// En augmentant `AppConfig['Messages']` avec le type du catalogue source
// (`messages/fr.json`), TOUTE clé passée à `useTranslations`/`getTranslations`
// et à `t("...")` est validée À LA COMPILATION. Une clé absente ou mal
// orthographiée devient une erreur `tsc` (au lieu d'un fallback silencieux).
//
// => Garde-fou pour les features futures : impossible de référencer une clé
//    inexistante sans casser le typecheck. Validation runtime : `pnpm i18n:check`.
//
// Fichier inclus via le `**/*.ts` du tsconfig ; n'exécute rien au runtime
// (pure augmentation de type, jamais importé par le code applicatif).

import messages from "../messages/fr.json";
import type { Locale } from "./config";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
