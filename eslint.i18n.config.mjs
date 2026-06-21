// =============================================================================
// eslint.i18n.config.mjs — Garde-fou i18n (OPT-IN, séparé du lint principal)
// =============================================================================
//
// POURQUOI une config à part ?
//   Le code legacy contient ~9000 strings user-facing codées en dur. Activer
//   cette règle dans `eslint.config.mjs` noierait le lint principal sous des
//   milliers de warnings et casserait/parasiterait le travail en cours des
//   autres devs. On la garde donc ISOLÉE et OPT-IN.
//
// OBJECTIF
//   Repérer les strings user-facing codées en dur dans le NOUVEAU code, pour
//   accompagner la migration i18n (next-intl) sans bloquer personne.
//
// COMMENT LA LANCER (jamais dans le pipeline lint standard)
//   pnpm lint:i18n
//   ≈ eslint -c eslint.i18n.config.mjs app components
//
// INSTALLATION DU PLUGIN (à faire séparément, NON inclus ici)
//   pnpm add -D eslint-plugin-i18next
//
// SÉVÉRITÉ
//   Règle en "warn" UNIQUEMENT — jamais "error". Non bloquant : c'est un
//   indicateur de migration, pas une barrière CI.
// =============================================================================

import i18next from "eslint-plugin-i18next";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    name: "i18n/no-literal-string (opt-in, warn only)",
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    plugins: {
      i18next,
    },
    rules: {
      // warn, jamais error — non bloquant.
      "i18next/no-literal-string": [
        "warn",
        {
          // Ne vérifier que le JSX user-facing (texte des éléments + attributs
          // visibles), pas le code TS/logique métier qui génère trop de bruit.
          // 'jsx-only' = texte JSX + attributs JSX ; on filtre ensuite les
          // attributs via les listes ci-dessous.
          mode: "jsx-only", // TODO vérifier option ('jsx-only' | 'jsx-text-only' | 'all')

          "jsx-attributes": {
            // Attributs user-facing à vérifier (texte visible / lu par les AT).
            include: [
              "placeholder",
              "title",
              "alt",
              "aria-label",
              "aria-placeholder",
              "aria-roledescription",
              "label",
            ],
            // Attributs techniques à IGNORER (jamais traduits).
            exclude: [
              "className",
              "class",
              "href",
              "src",
              "srcSet",
              "id",
              "key",
              "type",
              "rel",
              "target",
              "name",
              "role",
              "htmlFor",
              "style",
              "width",
              "height",
              "value",
              "defaultValue",
              "data-*",
            ],
          },

          // Ignorer les arguments des appels console.* (logs techniques).
          callees: {
            exclude: [
              "console.log",
              "console.warn",
              "console.error",
              "console.info",
              "console.debug",
            ],
          }, // TODO vérifier option (forme exacte de 'callees' selon la version du plugin)

          // Ne pas signaler les littéraux dans les templates strings techniques
          // (clés, URLs construites, etc.).
          "should-validate-template": false, // TODO vérifier option

          // Chaînes non-textuelles courantes à ignorer (symboles, séparateurs,
          // unités, codes). Évite la majorité des faux positifs.
          words: {
            exclude: [
              // Valeur par défaut documentée du plugin (regex de tokens non-mots).
              "[0-9!-/:-@[-`{-~]+",
              // Séparateurs / ponctuation isolés couramment en JSX.
              "·",
              "–",
              "—",
              "•",
              "→",
              "/",
              "|",
              "&",
              "%",
              "€",
              "·",
              "...",
              "…",
            ],
          }, // TODO vérifier option (clé 'words' vs 'message' selon la version)
        },
      ],
    },
  },
];
