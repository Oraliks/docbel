# Plan qualité /admin/bureaux — « bonnes adresses, bons liens »

> Objectif : chaque bureau a une **adresse officielle à jour**, est **lié à sa commune**
> et **résolu correctement** pour chaque CP (chômage, paiement, mutuelle), avec une
> **traçabilité de vérification** et des garde-fous pour que ça ne re-dérive pas.
>
> Mesure : `pnpm bureaux:audit` (script read-only, créé 2026-07-10). Chaque lot a un
> critère de sortie chiffré — on ne passe pas au lot suivant sans l'atteindre.

## Journal d'exécution (2026-07-12)

| Lot | Statut | Résultat mesuré |
|-----|--------|-----------------|
| **1 — Dédoublonnage** | ✅ **LIVRÉ** (commit 51eb923) | 30 doublons désactivés (réversibles), `vraisDoublons` 27→**0**, `multiParCommune` 27→**0**, couverture intacte (0 trou). Module pur `lib/bureaus/dedupe.ts` (18 tests). |
| **2 — Adresses officielles** | ✅ **LIVRÉ** (commit 8d188a9) | **1115 adresses officielles posées** (données validées Oraliks : Vlaanderen.be / ODWB / bruxellois / mi-is.be, REFNIS). `stubs` 910→**48**, `CP=0000` 404→**53**, `verified` 0→**1145**, tél manquants 1253→**219**. Script `bureaux:apply-official` (match INS+nom, cross-check CP, noms officiels écrasent les libellés OSM). Reste 48 stubs = 7 fusions 2025 absentes de notre table Commune. |
| **3 — Liens & assignments** | ✅ **LIVRÉ** (commit 1a844ff) | Communes sans chômage 421→**34**, paiement_* 0→**579**/organisme, résolveur **déterministe** (0 warning, Mons→MONS, Anvers→ANVERS). Module `assignment-plan.ts` (7 tests). |
| **4 — Vérification** | ✅ **LIVRÉ de fait** (via lot 2) | 1145 bureaux `verified=true` avec `verifiedBy=import:<source>` + `lastVerifiedAt`. Traçabilité + réversibilité (BureauRevision) en place. Reste : file de re-vérification manuelle des 447 non vérifiés (petites permanences / OP peu consultés). |
| **5 — Anti-dérive** | ✅ **LIVRÉ** (commit b4f97c2) | Tuiles « Intégrité & liens » dans l'onglet Santé (doublons / CP↔commune / communes sans chômage / assignments par service) + garde-fou blocklist dans l'import OSM (ne recrée plus les non-guichets). |

### Fusions 2025 — ALIGNÉES (2026-07-13)

Les **7 fusions communales flamandes du 01/01/2025** sont alignées sur REFNIS 2025
via `pnpm bureaux:merge-2025` + la chaîne `dedupe`/`apply-official`/`assign` :
Beveren-Kruibeke-Zwijndrecht [46030], Bilzen-Hoeselt [73110], Merelbeke-Melle
[44088], Nazareth-De Pinte [44086], Pajottegem [23106], Tessenderlo-Ham [71071],
Tongeren-Borgloon [73111]. Pour chacune : commune fusionnée créée (nouveau code
INS, `fusedFrom`), codes postaux + bureaux + assignments déplacés depuis les 16
anciennes communes (marquées `mergedIntoId`), adresse + nom officiels posés.
Vérifié : les 7 CP officiels résolvent vers la bonne commune fusionnée, CPAS +
maison communale vérifiés, **0 warning, 0 stub**. `stubs` 48→**20**,
`communesSansChomage` 34→**21**, communes actives 587→**578**.

Corrigé au passage : des **mappings PostalCode erronés préexistants** (Bocholt
possédait à tort 3700=Tongeren et 3740=Bilzen ; Tongres avait 3980=Tessenderlo)
— les CP officiels des fusions les écrasent désormais.

### 6 « INS-drift » = en fait 6 FUSIONS — réalignées (2026-07-13)

Les 6 communes signalées « INS-drift » étaient en réalité des **fusions 2025 où
la survivante a gardé son nom en absorbant une voisine** (vérifié VRT/L'Avenir +
REFNIS) : Wingene←Ruiselede, Tielt←Meulebeke, Lochristi←Wachtebeke,
Lokeren←Moerbeke, Hasselt←Kortessem, Bastogne←Bertogne (1re fusion wallonne).
`pnpm bureaux:realign-ins` renumérote la survivante (code INS REFNIS) + absorbe
la voisine (CP/bureaux/assignments déplacés, voisine `mergedIntoId`), puis
dedupe/apply-official/assign. Vérifié : les 6 CP officiels résolvent vers la
survivante au bon code INS, CPAS/commune officiels, 0 warning. `stubs` 20→**9**,
`communesSansChomage` 21→**10**, communes actives 578→**572** (6 voisines absorbées).

### « Renumérotations d'arrondissement » = LIGNES DUPLIQUÉES — consolidées (2026-07-13)

Les 5 « renumérotations » (+ Diegem) étaient en fait des **lignes de commune
DUPLIQUÉES** : pour chacune, la table avait une ligne à l'ancien code INS (retiré
de REFNIS) ET une ligne au nouveau code INS REFNIS (canonique, portant déjà les
codes postaux). `pnpm bureaux:dedup-communes` **absorbe la ligne obsolète dans la
ligne REFNIS** (CP/bureaux/assignments déplacés, obsolète `mergedIntoId`, CP
officiel forcé) : La Louvière [55022→58001], Mouscron [54007→57096], Soignies
[55039→55040], Binche [56011→58002], Maasmechelen [71047→73107], Zaventem/Diegem
[23107→23094]. Vérifié : les 6 CP officiels résolvent vers la ligne REFNIS avec
CPAS officiel, 0 warning. **Communes actives 572→566 (REFNIS = 565).**

**Reste : 1 seule commune** — **Borsbeek [11007]**, ABSENTE du fichier REFNIS
officiel fourni (validé « strictement identique au REFNIS »). Impossible à
trancher sans savoir si le fichier l'a omise ou si Borsbeek a fusionné — **à
clarifier par Oraliks**. Aussi : ~50 `cpCommuneIncoherents` = gaps table
PostalCode (bien liés) ; 5 communes sans chômage = CP hors `parametres-onem-cp`
(fallback proximité OK).

## État des lieux mesuré (2026-07-10)

1592 bureaux actifs : 613 COMMUNE · 591 CPAS · 317 SYNDICAT/OP · 38 ONEM · 4 PERMANENCE · 29 AUTRE.

| Problème | Mesure | Cause identifiée |
|---|---|---|
| Adresses stub « Adresse à confirmer » | **910** (502 CPAS + 408 COMMUNE, 57 % de la base) | seed de couverture jamais enrichi ; OSM n'a couvert que ~30-45 % |
| CP invalide (`0000` ou inconnu) | **404** | mêmes stubs, CP jamais résolu |
| Doublons stricts (type+CP+nom) | **42 groupes** | double import OSM (townhall inclut bâtiments historiques : « Archives », « Pavillon », « Oud Klooster », « Police Administrative »…) |
| Plusieurs CPAS/maisons communales pour une même commune | **27 communes** | idem — mauvais bâtiment retenu comme guichet |
| CP du bureau ∉ CP de sa commune liée | **152** | imports croisés, communes fusionnées 2025 |
| Communes sans bureau chômage résolu | **421 / 587** (225 assignments seulement) | `bureaux:sync-onem` étape 2 incomplète (8 ONEM sans `numeroOnem`, mappings insCode non pris) — la source officielle couvre pourtant 1298 CP |
| Assignments `paiement_*` / `mutuelle_*` | **0** | jamais générés → le résolveur tombe TOUJOURS en « estimé par proximité » avec warning |
| Bureaux vérifiés | **0 / 1592** | workflow `verified` existant mais jamais utilisé, aucune révision en base |
| Sans téléphone / site / horaires | 1253 / 1469 / 1167 | données jamais enrichies |

Ce qui va bien : lat/lng ok (37 manquants), 0 commune sans CPAS/maison communale (grâce aux stubs),
0 signalement en attente, l'infra est déjà là (santé, doublons API, révisions, sync scripts, aperçu user).

---

## Lot 1 — Purge du bruit et des doublons (1 script, ~1 session)

Le plus visible pour l'utilisateur : deux « CPAS » pour la même commune dont un s'appelle
« Archives de la Ville » ou « Police Administrative ».

- Nouveau `scripts/bureaux-dedupe.ts` (dry-run par défaut, `--yes` pour appliquer) :
  - cible les 42 groupes stricts + les 27 communes multi-bureaux (CPAS/COMMUNE) ;
  - règle de survie : adresse non-stub > `phone` renseigné > horaires > plus récent ;
  - les perdants passent `active=false` (**jamais de delete** — révisions + rollback possibles) ;
  - blocklist de noms non-guichets, partagée avec l'import OSM (`lib/bureaus/name-blocklist.ts`) :
    `archives|pavillon|police|klooster|kasteel|landshuis|historisch|museum`.
- Critère de sortie : `doublonsStricts=0`, `multiParCommune=0` à l'audit ;
  vérif visuelle onglet « Aperçu user » sur CP 7060, 7110, 3680, 6690.
- Risque : désactiver le mauvais du binôme → dry-run listé + revue manuelle du tableau avant `--yes`.

## Lot 2 — Adresses officielles CPAS + communes (le gros morceau, data)

910 stubs à remplacer par des adresses sourcées. Dans l'ordre coût/bénéfice :

1. **Re-passer `pnpm bureaux:import-osm --yes`** (non destructif, la couverture OSM progresse) — gratuit, avec la blocklist du lot 1 appliquée.
2. **Annuaire officiel des CPAS** (SPP Intégration sociale, mi-is.be — liste des 581 CPAS avec adresses) :
   scrape/CSV → `lib/data/cpas-officiels.json` + `scripts/bureaux-apply-cpas-officiels.ts`
   (match par commune via code INS, remplit street/CP/city/phone/website, corrige `0000`
   avec le CP principal de la commune). ⚠️ vérifier les conditions de réutilisation de la source.
3. **Maisons communales** : même mécanique depuis les annuaires officiels (BOSA / Vlaanderen / Wallonie).
4. `pnpm bureaux:geocode --yes` sur les adresses fraîchement posées.
- Règle de traçabilité : toute adresse posée par une source officielle ⇒
  `verified=true, verifiedBy="import:<source>", lastVerifiedAt=now()`.
- Critère de sortie : `stubs < 50`, `cpInconnus ≈ 0`.

## Lot 3 — Compléter les liens (le « lié comme il faut »)

1. **ONEM** : compléter le `numeroOnem` des 8 bureaux restants (match nom+CP sur le lookup
   `bureau-de-chomage`), puis dry-run `pnpm bureaux:sync-onem` pour diagnostiquer pourquoi
   seuls 225/1298 mappings ont pris, corriger, `--yes`.
   → objectif : **587/587 communes** avec assignment `chomage`.
2. **OP (CAPAC/FGTB/CSC/SYNOVA)** : générer les assignments `paiement_<org>` — pour chaque
   commune, la section de la même région la plus proche du centroïde (nouveau
   `scripts/bureaux-assign-op.ts`, réutilise la logique de l'API admin `auto-by-territory`).
   Le fallback proximité du résolveur reste comme filet, mais ne doit plus être le cas nominal.
3. **communeId manquants** : re-lier via CP les 30 SYNDICAT + 9 AUTRE (les 38 ONEM restent
   sans communeId, c'est voulu : ils passent par les assignments).
4. **152 mismatches CP↔commune** : script de re-liaison `communeId` depuis le CP réel du
   bureau, rapport des cas ambigus (CP partagés, fusions 2025) pour arbitrage manuel.
- Critère de sortie : `communesSansAssignmentChomage=0`, `assignmentsParService.paiement_* > 0`
  pour les 4 OP, `sansCommuneId=38` (ONEM uniquement), `cpCommuneIncoherents ≈ 0` ;
  l'aperçu user d'un CP wallon/flamand/bruxellois ne montre plus de warning « estimé par proximité ».

## Lot 4 — Vérification et fraîcheur (process, léger)

- Les lots 2-3 marquent déjà `verified` tout ce qui vient d'une source officielle.
- File de vérification manuelle **priorisée** dans l'onglet Santé : 38 ONEM → 70 sections de
  paiement → communes les plus consultées (bouton « Vérifier » existe déjà, route `verify`).
- Règle de péremption : `lastVerifiedAt > 12 mois` ⇒ badge « à revérifier » dans Santé.
- Critère de sortie : `nonVerifies` < 300 (le solde = petites permanences peu consultées).

## Lot 5 — Garde-fous anti-dérive (UI Santé, 2-3 tuiles)

- Onglet Santé : ajouter 3 tuiles à `health/route.ts` + `health-dashboard.tsx` :
  **doublons** (l'API `duplicates?scan=true` existe mais n'est pas surfacée),
  **CP↔commune incohérents**, **communes sans assignment chômage / paiement**.
- Import OSM : appliquer la blocklist + ne jamais écraser un bureau `verified=true`.
- `pnpm bureaux:audit` documenté dans le README des scripts, à relancer après tout import.

---

## Ordre, risques, validation

- Ordre strict 1 → 2 → 3 → 4 → 5 (dédupliquer avant d'enrichir, enrichir avant de lier).
- **DB Neon partagée** : tous les scripts en dry-run par défaut, `--yes` explicite,
  jamais de delete (désactivation), export CSV (`/api/admin/bureaux/export`) avant chaque lot.
- Validation par lot : `pnpm bureaux:audit` (critères chiffrés ci-dessus) + `pnpm test` +
  onglet « Aperçu user » sur une poignée de CP des 3 régions.

## Décisions à trancher (Oraliks)

1. **Doublons** : ok pour `active=false` plutôt que suppression ? (recommandé : oui, réversible)
2. **Source CPAS** : mi-is.be comme référence — conditions de réutilisation à confirmer ;
   alternative : croiser OSM + sites communaux, plus lent.
3. **OP attitré par proximité de centroïde** : acceptable comme règle d'assignation, ou
   faut-il chercher les zonages officiels de chaque OP (non publiés uniformément) ?
