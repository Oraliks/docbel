// =====================================================================
//  eC3.2 — Vocabulaire partagé : libellés UI & notices pédagogiques
// ---------------------------------------------------------------------
//  Source de vérité unique des clés/textes courts du simulateur. Le
//  contenu par défaut (`content.ts`) en dérive les tableaux éditables
//  `simulator.labels` / `simulator.notices`, et le simulateur les utilise
//  comme repli (`getLabel`/`getNotice`). Modifier le TEXTE se fait ensuite
//  dans le builder ; ce module garantit que chaque clé a toujours un repli.
//  Pur (server-safe), aucune dépendance.
// =====================================================================

/** Libellés courts (boutons, titres d'étape, en-têtes de carte). */
export const EC32_LABELS: Record<string, string> = {
  // Navigation générale
  'nav.next': 'Étape suivante',
  'nav.back': 'Étape précédente',
  'nav.restart': 'Recommencer la simulation',
  'nav.toCalendar': 'Aller au calendrier',

  // Étape 1 — Connexion simulée
  'login.title': 'Connexion simulée',
  'login.intro':
    'Choisissez un moyen d’identification pour comprendre comment se passe la connexion. Ici, rien n’est demandé et aucune connexion réelle n’a lieu.',
  'login.eid': 'Comprendre la connexion eID',
  'login.itsme': 'Comprendre itsme',
  'login.frontalier': 'Je suis travailleur frontalier',
  'login.noMeans': 'Je n’ai pas de moyen d’identification',
  'login.continue': 'Démarrer la simulation',

  // Étape 2 — Déclaration sur l’honneur
  'declaration.title': 'Déclaration sur l’honneur — simulation',
  'declaration.intro':
    'Lors de la première connexion officielle, vous choisissez le mois de départ, lisez le manuel et les conditions, puis confirmez que vous passez à la voie électronique.',
  'declaration.monthField': 'Mois à partir duquel j’utilise l’eC3.2',
  'declaration.checkbox':
    'Je confirme avoir lu le manuel et les conditions, et utiliser désormais la voie électronique (case fictive).',
  'declaration.continue': 'Continuer la simulation',

  // Étape 3 — Choix de l’employeur
  'employer.title': 'Choisir l’employeur',
  'employer.intro':
    'Choisissez l’employeur qui vous a mis en chômage temporaire. Vos autres occupations seront indiquées sur cette carte.',
  'employer.enterprise': 'Numéro d’entreprise (fictif)',
  'employer.continue': 'Choisir cet employeur',

  // Étape 4 — Choix du mois
  'month.title': 'Choisir le mois',
  'month.intro':
    'Sélectionnez la carte du mois à compléter. Les cartes déjà envoyées sont verrouillées.',
  'month.locked': 'Envoyée — verrouillée',
  'month.notYet': 'Pas encore disponible',
  'month.activatePast': 'Activer un mois antérieur',

  // La carte
  'card.title': 'Carte de contrôle — simulation',
  'card.employer': 'Employeur',
  'card.enterprise': 'Numéro d’entreprise',
  'card.lastUpdate': 'Dernière mise à jour',
  'card.corrections': 'Corrections',
  'card.download': 'Télécharger l’aperçu — simulation',
  'card.listView': 'Vue liste',
  'card.calendarView': 'Vue calendrier',
  'card.calendarTab': 'Calendrier',
  'card.legendTab': 'Légende',
  'card.adapt': 'Adapter les jours sélectionnés',
  'card.send': 'Envoyer la carte — simulation',
  'card.firstSend': 'Première date d’envoi possible',
  'card.affiliation': 'Je suis inscrit auprès d’un organisme de paiement',

  // Sélecteur de situation
  'selector.title': 'Quelle situation pour ce(s) jour(s) ?',
  'selector.workElsewhereGroup': 'Travail ailleurs que chez l’employeur',
  'selector.save': 'Enregistrer ce jour',
  'selector.saveMulti': 'Enregistrer ces jours',
  'selector.cancel': 'Annuler',
  'selector.selected': 'sélectionné·s',

  // Calendrier
  'calendar.selectHint': 'Cliquez sur un jour pour le sélectionner. Cliquez à nouveau pour le retirer.',
  'calendar.clear': 'Tout désélectionner',
  'calendar.legend': 'Légende des situations',

  // Étape 7 — Vérifier
  'verify.title': 'Vérifier la carte',
  'verify.intro':
    'Relisez vos encodages avant l’envoi simulé. Vérifiez surtout les jours travaillés et les jours d’inaptitude.',

  // Vue liste
  'list.date': 'Date',
  'list.situation': 'Situation',
  'list.correction': 'Correction',
  'list.edit': 'Modifier',
  'list.empty': 'Aucun jour à afficher pour ce mois.',
}

/** Notices pédagogiques (encadrés, paragraphes explicatifs). */
export const EC32_NOTICES: Record<string, string> = {
  // Connexion
  'login.eid':
    'L’eID est votre carte d’identité électronique. Dans la vraie application, vous l’utilisez avec un lecteur de carte et votre code PIN pour vous identifier en toute sécurité.',
  'login.itsme':
    'itsme est une application mobile d’identité numérique. Dans la vraie application, vous confirmez votre identité sur votre smartphone, sans lecteur de carte.',
  'login.frontalier':
    'Les travailleurs frontaliers disposant d’un numéro de registre national ou d’un numéro BIS peuvent utiliser un moyen d’identification électronique reconnu au niveau européen (eIDAS). Si ce n’est pas possible, une clé numérique alternative peut être activée après contact avec l’ONEM.',
  'login.noMeans':
    'Sans moyen d’identification électronique, vous pouvez prendre contact avec l’ONEM pour activer une clé numérique alternative. Cette simulation ne demande, elle, aucune identification.',

  // Déclaration & mois
  'declaration.monthImportance':
    'Dans la vraie application, le choix du mois est important : il détermine à partir de quand vous utilisez l’eC3.2.',
  'month.rule':
    'La carte eC3.2 est accessible uniquement pour le mois précédent. En juin → seul mai est disponible. Dès le 1er juillet, mai disparaît et juin devient accessible à son tour.',
  'month.activatePast':
    'Si vous avez activé l’eC3.2 à partir d’un mois donné mais que vous étiez déjà en chômage temporaire avant, vous pouvez activer un mois antérieur. Une nouvelle déclaration sur l’honneur vous est alors demandée.',
  'month.cards':
    'Pour chaque employeur, vous voyez la carte du mois en cours, celle du mois suivant, les cartes des mois précédents non envoyées, et les cartes non utilisées pour les mois sans chômage temporaire.',

  // Calendrier — situations par défaut & icônes auto
  'calendar.defaultChomage':
    'Par défaut, les cases du calendrier sont considérées comme « Chômage ». Vous ne devez rien indiquer si vous êtes effectivement en chômage temporaire ce jour-là. Si vous travaillez ailleurs, vous devez l’indiquer.',
  'calendar.notApplicable':
    'Les cases grisées (« Pas d’application ») concernent les jours sans contrat avec l’employeur choisi (contrat débuté ou terminé en cours de mois) et les jours hors du mois sélectionné.',
  'calendar.firstEffectiveDay':
    'Le premier jour de chômage effectif du mois est signalé automatiquement (chômage économique, intempéries ou accident technique). Pour les autres types de chômage temporaire, aucune icône n’est affichée.',
  'calendar.firstSendNoIcon':
    'L’absence de cette icône pendant le premier mois d’utilisation ne bloque pas le fonctionnement de la carte.',
  'calendar.fillUntilEnd':
    'La carte doit être complétée à partir du premier jour de chômage effectif jusqu’au dernier jour du mois. Dans la construction, la carte doit toujours être remplie.',

  // Enregistrement & envoi
  'save.unsaved':
    'Vos modifications ne sont pas enregistrées. Sauvegardez avant de continuer.',
  'send.firstSendBefore':
    'L’envoi n’est pas encore possible : la première date d’envoi possible n’est pas atteinte. Même lorsque cette date tombe avant la fin du mois, la carte doit être complétée correctement jusqu’au dernier jour du mois. (Cette simulation n’envoie jamais rien.)',
  'send.noPaymentOrg':
    'Dans la vraie application, vous pouvez compléter la carte, mais vous devez être affilié à un organisme de paiement (CAPAC, CSC, FGTB ou CGSLB) pour pouvoir l’envoyer.',
  'send.notNeeded':
    'Si vous ne demandez pas d’allocations, l’envoi n’est pas nécessaire. Si vous souhaitez demander des allocations, l’inscription auprès d’un organisme de paiement est nécessaire.',

  // Correction
  'correction.help':
    'Dans la vraie application, une explication claire aide les inspecteurs à comprendre la modification. Seules les cartes non envoyées peuvent être corrigées ; l’ONEM est informé des modifications.',
  'correction.locked':
    'Cette carte est envoyée et verrouillée dans la simulation. Une carte envoyée ne peut plus être modifiée.',

  // Règle d’enregistrement du travail
  'work.beforeStart':
    'Tout travail doit être enregistré avant de commencer à travailler.',
}

/** Repli sûr : renvoie le libellé pour une clé, sinon la clé elle-même. */
export function ec32Label(key: string): string {
  return EC32_LABELS[key] ?? key
}

/** Repli sûr : renvoie la notice pour une clé, sinon une chaîne vide. */
export function ec32Notice(key: string): string {
  return EC32_NOTICES[key] ?? ''
}

// ─────────────────────────── i18n parallèle (next-intl) ───────────────────────────

/**
 * Clé i18n parallèle (next-intl, namespace `public.ec32Content.labels`) pour
 * chaque libellé court — les valeurs FR d'`EC32_LABELS` restent le fallback.
 * Les composants peuvent résoudre via :
 *   t(ec32LabelKey(key) as Parameters<typeof t>[0]) ?? ec32Label(key)
 */
export function ec32LabelKey(key: string): string {
  return `public.ec32Content.labels.${key}`
}

/**
 * Clé i18n parallèle (next-intl, namespace `public.ec32Content.notices`) pour
 * chaque notice pédagogique — les valeurs FR d'`EC32_NOTICES` restent le
 * fallback.
 */
export function ec32NoticeKey(key: string): string {
  return `public.ec32Content.notices.${key}`
}

/**
 * Helper de résolution i18n « clé parallèle + fallback FR » :
 * - si la clé est définie ET résolue (`t.has(key)`) → renvoie `t(key)` ;
 * - sinon → renvoie le `fallback` (chaîne FR provenant de la data lib).
 *
 * Utilisé pour les champs `*Key` ajoutés en parallèle sur les items
 * `lib/ec32/{scenarios,situations,mistakes,faq,…}.ts` afin d'éviter de
 * casser l'existant : la donnée FR reste affichée tant que la clé n'est
 * pas câblée côté next-intl.
 *
 * Le typage `Parameters<typeof t>[0]` n'est pas exposé proprement par
 * next-intl ; on passe la clé en `string` à travers un narrowing local
 * pour rester compatible avec le typage strict des namespaces.
 */
export type Ec32Translator = {
  (key: string): string
  has(key: string): boolean
}

export function ec32ResolveKey(
  t: Ec32Translator,
  key: string | undefined,
  fallback: string,
): string {
  if (key && t.has(key)) {
    return t(key)
  }
  return fallback
}
