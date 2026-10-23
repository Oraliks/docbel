# Intégration du design public — 23/10/2026

Direction visuelle fournie et validée par le propriétaire : `DocBel-prototype-interactif.html`,
`DocBel-apercu-ordinateur.png` et `DocBel-apercu-mobile.png` du pack design. Les captures
ont été consultées ; le HTML a été lu, mais son ouverture `file://` a été refusée par la
politique du navigateur. Aucun cadre de démonstration ni données fictives ne sont livrés.

L’arbitrage humain transmis par le chef le 23/10 conserve la V1 publique **sans nouveau
compte visiteur ni dossier enregistré**, pendant les travaux. Les fermetures sont temporaires.
La branche design dépend des lots serveur A/C/D (PR83/84/85, base D `670fec24`).
Le travail reste en développement ; ni fusion main ni production ne sont autorisées.

## Composants et raccordements

| Référence | Composant ou route | Fonctionnement conservé |
|---|---|---|
| Header et quatre destinations | `landing/header`, `AppLayoutClient` | vrais liens Next, recherche commune, accès privé |
| Navigation mobile | `PublicBottomNav`, `public-navigation` | remplacée par les actions propres aux parcours |
| Accueil | `app/page`, `LandingHero`, `WizardTeaser` | RSC/Suspense, catalogue actif/audiences, ancienne consultation réelle |
| Démarches | `/mon-dossier`, `/d/[slug]` | moteur d’orientation et sélection existants, informations et documents autonomes |
| Anciennes démarches | `BundleRunner`, `DemandeList`, `/reprendre` | propriété vérifiée côté serveur, lecture seule et téléchargements gardés |
| Formulaire | `FormShell`, `PdfField`, `FormStepper`, `SubmitFooter` | schéma, validation, valeurs et génération existants |
| Récapitulatif | `FormAnswerSummary` | lit les réponses visibles, options et lignes structurées sans dériver de faits |
| Aide | `/aide`, `ContextHelpPanel` | glossaire/contact réels, aide mobile en panneau inférieur, focus Base UI |
| Langue | `LocaleSwitcher`, `WelcomeLocaleModal` | toutes langues existantes, cookie et rafraîchissement RSC sans rechargement |
| Aa | `AccessibilityToolbar` dans le dialogue commun | même magasin de préférences et thème existants |
| Lecture | `SpeechButton`, `useSpeech` | texte public explicite, langue du texte, voix compatibles, arrêt et erreurs |

## Tokens et règles de réutilisation

Les noms historiques `--glass-*` restent la compatibilité des outils ; ils désignent
désormais les surfaces opaques approuvées. Couleurs et largeur du shell sont centralisées
dans `app/globals.css`. `--glass-accent-soft` et `--glass-cta-text` sont des alias.
Ne pas ajouter une seconde palette, un second sélecteur de langue ou un magasin de réponses.
Les polices Manrope/Fraunces déjà chargées sont réutilisées ; aucune dépendance ajoutée.

Les surfaces professionnelles, admin et auth gardent shadcn. Les portails publics qui
ont besoin de tokens spécifiques utilisent `.docbel-public-popup`. Les aides longues
doivent avoir fermeture explicite/Échap et restitution du focus. Les champs anciens
sont désactivés via le contexte Base UI et le `fieldset` natif ; navigation et aide restent actives.
Les cookies réservent leur hauteur réelle pour ne pas masquer navigation et actions mobiles.

La couleur n’est jamais le seul indicateur. Réutiliser les contrôles natifs, les libellés
persistants, `aria-invalid` et les erreurs associées. Le mode sombre, le contraste renforcé,
les grandes tailles, le mouvement réduit et RTL font partie du système commun.
Dates : `formatDate`/`formatDateTime`, JJ/MM/AAAA, heures 24h.

## Recette isolée et preuves

`scripts/seed-design-fixture.ts` refuse toute URL autre que la base synthétique
`docbel_design@127.0.0.1:5434/docbel_design_20261023`, vérifie aussi son identité SQL et
pose un marqueur d’isolation. Il ne doit pas être exécuté sur une base partagée.
Il crée un vrai AcroForm local et des métadonnées synthétiques ; aucun mock n’est livré
dans l’application. Le PDF source sous `private/uploads` et les journaux restent ignorés.

Les deux fichiers `tests/e2e/public-design*.spec.ts` ciblent exclusivement le serveur de
recette sur localhost:3107. Ils utilisent Edge/Chromium disponible, sans vidéo (FFmpeg
absent), et conservent captures/traces. Ce sont des émulations de dimensions et de texte,
pas des tests physiques. Le profil admin réellement authentifié, OAuth et les anciens
liens e-mail hors fixtures nécessitent une recette dédiée ; aucune donnée réelle n’est utilisée.

Exécution reproductible : schéma courant appliqué uniquement à une nouvelle base locale
jetable par SQL, fixture dédiée, puis application avec DATABASE_URL/DIRECT_URL pointant
explicitement vers cette base, clés factices, URL localhost:3107 et RATE_LIMIT_BACKEND=memory
(mode de développement existant). Aucune migration applicative, aucun `db push`/reset/seed global.

Validation locale : suite Vitest complète, tests ciblés complémentaires, lint avec baseline
et suppression d’une exemption devenue inutile, contrôle i18n ; captures application et
résultats navigateur conservés dans `test-results`. Le build local Turbopack refuse la
jonction node_modules du worktree : ne pas modifier fonts/config ni ajouter un module
virtuel pour contourner cette limite ; la CI propre de la PR doit confirmer le build.

Le référentiel familial, moteurs, questions/options, calculs, seuils, barèmes, seeds et
bindings PDF restent inchangés. Les questions de démonstration du prototype ne sont pas
utilisées. Une génération autonome n’est pas un envoi à l’administration.

## État de livraison après reprise

Une première mise en attente a été corrigée par le propriétaire : **seule la production
est différée**. Le travail de développement, la revue et la recette ont repris sur
`codex/design-valide`, base D `670fec2424ed93e9e6bf06744a644e60f9acc515`.
Le delta antérieur a été sauvegardé avant reprise. Aucun reset, édition du checkout
partagé, fusion main ou déploiement de ce design.

La livraison minimale des fermetures est indépendante (PR86) ; sa future réconciliation
sera une intégration Git contrôlée au SHA final communiqué, sans copier son worktree.

Contrôles acquis :

- Suite complète Vitest : **3269 réussis, 1 ignoré**, avant les derniers compléments.
  Compléments récapitulatif/navigation, transition, lecture et présentation vérifiés
  ensuite ; les tests métier de référence n’ont pas été modifiés.
- Lint complet avec baseline : **0 erreur / 58 avertissements** ; lint ciblé final réussi.
  Une ancienne exemption WelcomeLocaleModal a été retirée, aucune ajoutée.
- i18n final réussi : aucun JSON invalide ni erreur ICU. Les clés nouvelles sont en FR ;
  les autres langues conservent leur fallback existant, sans traduction non relue.
- Diff-check normalisé ; aucune dépendance, configuration de build ou migration modifiée.
- Aa à 320px CSS et texte 200% : correction des hauteurs de boutons et cinq passages
  stables réussis, dont trois répétitions. Les six autres cas accessibilité avaient réussi :
  premiers accès/cookies/navigation, aide/focus, contrastes, login, gardes privées et voix absente.
- Edge/Chromium : quatre dimensions 320/390/768/1440, ancienne consultation,
  validation conditionnelle/retour, aide clavier/focus, langue après saisie, réglages/sombre,
  arabe RTL. Le dernier cas résumé/PDF réel a réussi : HTTP200 application/pdf,
  **9803octets, une page aplatie**, réponses « Orange synthétique » et « Recette génération »
  présentes dans le texte extrait et PDF différent du source. Aucun mock API pour ce parcours.
- La recette a révélé une garde générique exigeant un signataire même sans signature :
  la garde exige maintenant un nom seulement quand le schéma comporte une signature.
  Le bouton distingue génération seule et signature ; aucun signataire fictif ajouté.
- Le résultat libère la cale de hauteur du formulaire : assertion navigateur 0px,
  PDF et contenu vérifiés à nouveau après cette correction de mise en page.
- Le profil en lecture seule n’expose plus la suppression déjà fermée côté serveur.
- Le récapitulatif utilise les valeurs dérivées déjà affichées et envoyées au moteur,
  sans recalcul distinct. Modifier est limité aux champs accessibles, éditables et non automatiques.
  Revue indépendante ciblée : corrections confirmées, aucun défaut résiduel constaté.

Limites conservées : build local Turbopack arrêté par la jonction node_modules hors racine.
Le diagnostic TypeScript explicite reste en échec sur des fichiers hors delta :
Leaflet/markercluster absent de l’installation liée, ancien test provider familial,
NODE_ENV readonly dans test barèmes et valeurs undefined dans tests réglementaires.
Aucune erreur du delta design dans ce diagnostic. Une CI propre sur la branche doit
confirmer installation figée, lint, suite complète, i18n et build avant intégration.
Chromium est testé via Edge ; WebKit, FFmpeg et appareils physiques indisponibles.
Aucun compte pro/admin réel ni OAuth externe utilisé pour les captures.

Les créations/sauvegardes anonymes ou connectées restent interdites par l’arbitrage
V1 temporaire : les tests vérifient leur fermeture et les lectures anciennes, sans
réintroduire une écriture pour satisfaire un scénario historique.

Preuves locales (synthétiques uniquement) :
`test-results/design-recipe-final/`, `test-results/design-a11y-reprise/`,
`test-results/design-a11y-reprise-repeat/` et `test-results/design-recipe-verified/`.
Les captures question/validation/récapitulatif/résultat et le PDF généré sont aussi
conservés dans le dossier de visualisations de cette session, sous `design-recipe-verified/`.
Journaux `.validation-design-*.log` ignorés ; ne pas les publier en bloc.

Cluster synthétique conservé sous le dossier de visualisations de la session,
`pg-design`, port5434 ; serveur applicatif de recette localhost:3107.
Les services de recette appartiennent à cette session et peuvent être arrêtés sans
supprimer les données. Aucun service partagé n’a été modifié.
