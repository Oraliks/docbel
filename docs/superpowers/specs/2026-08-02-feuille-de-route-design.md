# Spec — Feuille de route « Et maintenant ? » (fin du parcours dossier)

Date : 2026-08-02 · Design **validé par Oraliks** (brainstorm de session, 3 décisions actées).
Prochaine étape : plan d'implémentation (writing-plans), puis exécution par petits lots.

## Problème

Le citoyen termine son dossier, télécharge un zip de formulaires officiels… et se
débrouille. Rien ne lui dit **où déposer** ses documents, **qui doit signer**
(le C1-Partenaire se signe à deux — item #40 de NEXT_ACTIONS), **en combien
d'exemplaires**, **quoi joindre**, ni que Docbel ne remplace pas une décision de
l'ONEM (item #35). Toutes les données nécessaires existent déjà en base
(réponses du run, compagnons déclenchés, bureaux officiels avec assignments par
commune) ; il manque uniquement le moteur qui les assemble et les restitue.

## Décisions actées (Oraliks, 2026-08-02)

1. **Ancrage V1** : écran « Mes documents » (après le verrou du dossier) **+**
   page de garde imprimable ajoutée au zip et à l'envoi par e-mail. Les
   documents remplis hors dossier (publicPath) sont **hors périmètre V1**.
2. **Organisme de paiement** : choisi par le citoyen via un **sélecteur sur la
   feuille de route elle-même**, côté client, **jamais stocké** (l'OP peut
   révéler une affiliation syndicale — donnée sensible art. 9 RGPD).
3. **Approche** : moteur **pur en code** + registre de faits par document
   (patron `section-help.ts`), double rendu écran/PDF du même modèle. Pas de
   contenu réglementaire en AppSetting (l'admin-editable reste une évolution
   possible, pas le socle).

## Architecture

```
lib/feuille-de-route/
  model.ts       ← types du modèle (blocs) — aucune dépendance lourde
  registry.ts    ← faits statiques par document, sourcés du PDF officiel
  build.ts       ← buildFeuilleDeRoute(...) : fonction pure, testée
  __tests__/
```

- `buildFeuilleDeRoute({ documents, payloads, bureaux, choixOP }) → FeuilleDeRoute`
  produit une liste de **blocs typés** :
  - `ou-deposer` — destinataire (organisme de paiement) + bureau compétent
    (nom, adresse, lien fiche) pour la commune du citoyen ;
  - `signatures` — qui doit signer chaque document (ex. C1-Partenaire : le
    citoyen ET le partenaire, la case partenaire se signe à la main) ;
  - `exemplaires` — nombre d'exemplaires par document quand le papier l'exige
    (ex. bandeau « EN 3 EXEMPLAIRES » du C1-Partenaire) ;
  - `pieces` — liste réelle des documents du run (compagnons déclenchés
    inclus, déjà résolus par le système de triggers) ;
  - `prudence` — « Docbel ne remplace pas une décision de l'ONEM ou de votre
    organisme de paiement » (phrase fixe, présente sur écran ET page de garde).
- Le **registre** porte les faits statiques par document. Chaque fait est
  recopié du PDF officiel (`private/pdfs/<DOC>_FR.pdf`, extraction markitdown)
  avec sa source en commentaire. **Aucun fait non sourçable n'entre en V1** —
  en particulier les délais réglementaires, absents tant qu'ils ne sont pas
  sourcés dans `docs/knowledge/chomage/` et validés.

## Données dynamiques

- **Commune du citoyen** : extraite des payloads du run via les clés canoniques
  `adresse.codePostal` / `adresse.commune` (`lib/pdf-forms/canonical/vocabulary.ts`),
  repli sur les ids de champs du C1. Extraction côté serveur au rendu de
  l'écran Mes documents (les payloads du run y sont déjà disponibles).
- **Bureaux compétents** : `lib/bureaus/resolve.ts` expose déjà la résolution
  par code OP choisi (`OP_CODES = ["capac", "fgtb", "csc", "synova"]`) et
  `finder-model.ts` fournit les `organismesPaiement` compétents par commune.
  La feuille de route **réutilise ces briques et leurs libellés existants** —
  aucun nouveau référentiel d'organismes.
- **Replis** : commune introuvable, sans assignment, ou payload C1 absent du
  run → bloc `ou-deposer` générique (« déposez auprès de votre organisme de
  paiement ») + lien vers le finder `/bureaux`. Jamais d'écran vide.

## Écran (Mes documents)

- Un panneau « Et maintenant ? » sous la zone de téléchargement, visible après
  le verrou du dossier.
- Chips : « Quel est votre organisme de paiement ? » — CAPAC / FGTB / CSC /
  SYNOVA (libellés repris du finder) + « Je ne sais pas ».
- « Je ne sais pas » → courte explication de la notion (l'organisme auprès
  duquel vous êtes inscrit ; la CAPAC est l'organisme public) + les bureaux
  compétents des quatre OP pour la commune.
- Le choix est un state React local. Il n'est **ni persisté, ni envoyé** en
  dehors de la requête de génération décrite ci-dessous.
- Design : glass mauve public, tokens existants, gamification douce (règles du
  design system). Vouvoiement, vocabulaire « démarche ».

## Page de garde (zip + e-mail)

- La route de régénération existante (`regenerateItems`) accepte un paramètre
  optionnel `organismePaiement` (enum `OP_CODES`, validée Zod).
- Utilisé pour composer une page A4 en tête du zip (pdf-lib, même modèle que
  l'écran), puis **oublié** : non stocké, non journalisé — la ligne
  `PdfFormSubmissionLog` reste strictement identique à aujourd'hui
  (`stablePayloadHash`, `diagnosticsSummary`), sans trace du choix d'OP.
- Sans paramètre (ou « je ne sais pas ») : page générique listant les bureaux
  compétents des quatre OP.
- La page de garde est **informative, non officielle** : bandeau explicite
  « page d'aide Docbel — ne pas envoyer à l'ONEM », pour qu'elle ne soit pas
  confondue avec un formulaire.

## RGPD

- Choix d'OP : donnée potentiellement art. 9 (affiliation syndicale) →
  **jamais écrite** (DB, logs, analytics). Seul un event de fréquentation
  anonyme du panneau (sans l'OP choisi) peut alimenter les analytics existants.
- Aucune donnée nouvelle stockée : le moteur ne lit que ce que le run porte déjà.

## Périmètre V1 / exclusions

| Inclus | Exclu (V2+) |
|---|---|
| Parcours dossier (écran Mes documents + zip/mail) | Documents remplis hors dossier (publicPath) |
| Blocs : où déposer, signatures, exemplaires, pièces, prudence | Délais réglementaires (tant que non sourcés) |
| 100 % FR (comme les seeds) | « Que se passe-t-il après le dépôt » (accusé, suivi, premier paiement) |
| Réutilisation resolve.ts / finder-model.ts | Contenu admin-editable (AppSetting) |

## Contenu métier & sourçage

- Brouillon du registre rédigé depuis les PDF officiels (exemplaires et
  signatures y sont imprimés) ; toute formulation douteuse est **demandée à
  Oraliks, jamais rédigée** (règle anti-invention du dépôt).
- Passe `/verif-reglementation` sur `registry.ts` avant commit.

## Tests & validation

- Moteur pur : modèle complet pour un run C1 + compagnons ; replis (commune
  absente, OP non choisi, run sans C1) ; aucun bloc `ou-deposer` précis sans
  bureau résolu.
- Page de garde : smoke de génération (le zip contient N documents + 1 page de
  garde ; la ligne de log est inchangée).
- `pnpm test` · `pnpm build` · `pnpm lint` (pas de nouvelle erreur) ·
  relecture écran clair/sombre.

## Liens NEXT_ACTIONS

- **#40 absorbé** : le bloc `signatures` du C1-Partenaire dit qui signe et en
  combien d'exemplaires envoyer (texte sourcé du bandeau imprimé).
- **#35 lié mais séparé** : la feuille porte la phrase de prudence pour le
  parcours dossier ; l'encart par écran document reste un item à part.
