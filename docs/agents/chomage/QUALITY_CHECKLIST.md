# QUALITY_CHECKLIST — Contrôle qualité d'un outil chômage

> À passer **avant de livrer** tout outil chômage (wizard, formulaire assisté, arbre de
> décision, simulateur d'orientation). Un point qui échoue = corriger **ou** rétrograder
> le résultat concerné en `a_verifier`. Aucun point n'est « optionnel par défaut ».

Cocher chaque ligne :

## Règles & sources
- [ ] **Chaque règle utilisée est sourcée** (champ `source_url` réel, ou explicitement
      `TODO_SOURCE_OFFICIELLE` + `confidence: to_verify`).
- [ ] **Date de validité** présente pour chaque règle (`effective_from`) quand elle existe.
- [ ] **Distinction avant / après le 01/03/2026** explicite partout où la réforme change l'issue.
- [ ] **Cas transitoires** traités séparément (jamais appliqués « par défaut »).
- [ ] Aucune règle `deprecated` n'est appliquée comme si elle était active.
- [ ] Tous les `rule_id` cités **existent** et sont listés dans [`RULES_INDEX.md`](RULES_INDEX.md).

## Prudence & langage
- [ ] **Phrase de prudence obligatoire** affichée (champ `legalWarning`), même en `recommande`.
- [ ] **Aucune promesse de droit** : pas de « vous avez droit à », « l'ONEM acceptera »,
      « vous recevrez », etc. (cf. phrases interdites dans [`AGENT_CHOMAGE.md`](AGENT_CHOMAGE.md)).
- [ ] **Résultat « à vérifier » possible** : l'outil sait produire un `a_verifier` complet.
- [ ] Langage **simple et clair** (pas de jargon non expliqué ; renvoyer au glossaire si besoin).
- [ ] Distinction nette entre **ce qui est sûr**, **ce qui dépend de la situation**, **ce qui
      doit être vérifié**.

## Contenu du résultat
- [ ] **Documents probables** listés (`probableDocuments`).
- [ ] **Sources officielles** listées (`officialSources`) avec institution + URL (ou `null`).
- [ ] **`rule_id` utilisées** exposées (`ruleIdsUsed`).
- [ ] **Informations manquantes** listées (`requiredInfo`) quand elles changent l'issue.
- [ ] **Red flags** remontés (`redFlags`) quand un cas de [`RED_FLAGS.md`](RED_FLAGS.md) s'applique.

## Périmètre & exactitude
- [ ] **Aucun calcul officiel garanti** : les montants proviennent de
      [`lib/calculators/chomage.ts`](../../../lib/calculators/chomage.ts), jamais d'un barème
      recopié dans la doc, et restent présentés comme **estimations**.
- [ ] **Pas de mélange** chômage complet / chômage temporaire / AGR / allocations d'insertion
      dans un même verdict sans séparation explicite.
- [ ] L'outil **ne tranche pas** une fin de droit, une sanction, une exclusion ou une radiation.

## Données & conformité
- [ ] **Aucune donnée sensible inutile** demandée (pas de NISS/IBAN si l'orientation ne l'exige
      pas ; minimiser — cf. RGPD du projet).
- [ ] Les données saisies ne servent qu'à l'orientation et ne sont pas présentées comme
      transmises à l'ONEM.

## Tests & accessibilité
- [ ] **Tests métier** présents et alignés sur [`TEST_CASES.md`](TEST_CASES.md)
      (au moins les cas pertinents pour cet outil).
- [ ] **Accessibilité** : labels, contrastes, navigation clavier, textes d'aide
      (cf. règles design/i18n du projet).
- [ ] Textes user-facing **i18n** (next-intl), pas de chaîne codée en dur.

---

### Règle de décision
Si **un seul** point « Règles & sources » ou « Prudence & langage » échoue pour un cas donné,
le résultat de ce cas **doit** être `a_verifier`. Ces deux familles priment : mieux vaut un
outil prudent et incomplet qu'un outil affirmatif et faux.
