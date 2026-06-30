# PROMPTS — Prompts réutilisables pour les sessions Claude Code « chômage »

> Copier-coller le prompt voulu au début d'une nouvelle session. Tous supposent que l'agent
> lit d'abord [`AGENT_CHOMAGE.md`](AGENT_CHOMAGE.md) puis [`RULES_INDEX.md`](RULES_INDEX.md),
> et **uniquement** les fichiers `knowledge/` nécessaires.

---

## 0. Amorce commune (à mettre en tête de tout prompt)

```txt
Lis d'abord /docs/agents/chomage/AGENT_CHOMAGE.md.
Lis ensuite /docs/agents/chomage/RULES_INDEX.md.
Lis uniquement les fichiers knowledge nécessaires à la tâche.

Contraintes permanentes :
- Utilise uniquement les rule_id documentées.
- Si une règle manque ou n'est pas sourcée, crée un état « à vérifier ».
- N'affiche jamais une décision juridique définitive ni un droit garanti.
- Ajoute la phrase de prudence obligatoire.
- Ne mélange pas chômage complet, chômage temporaire, AGR et allocations d'insertion.
- Ne mélange pas les règles avant / après le 01/03/2026.
- Les montants viennent de lib/calculators/chomage.ts, jamais d'un barème recopié.
```

---

## 1. Créer un wizard chômage

```txt
[Amorce commune]

Objectif :
Créer le wizard « <NOM DU WIZARD> » (ex. chômage complet après fin de contrat).

Attendus :
- Une définition conforme à DocbelWizardDefinition (OUTPUT_SCHEMAS.md).
- Des questions qui couvrent les infos de l'étape 3 de l'ordre de raisonnement
  (âge, région, situation familiale, dates, type de contrat…).
- Au moins un résultat matchLevel = a_verifier pour les cas sensibles.
- ruleIdsUsed renseignés et existants ; sinon a_verifier.
- legalWarning sur chaque résultat.
- Des cas de test métier alignés sur TEST_CASES.md.

Ne crée pas de nouvelle table ni de nouvelle dépendance sans justification.
Passe la QUALITY_CHECKLIST.md avant de livrer.
```

---

## 2. Créer un outil de formulaire (assistance C1/C4/C109/eC3.2…)

```txt
[Amorce commune]
Lis aussi /docs/knowledge/chomage/formulaires-onem.md.

Objectif :
Créer un outil qui aide l'utilisateur à identifier / préparer le formulaire <CODE>.

Attendus :
- L'outil EXPLIQUE l'usage du formulaire (vulgarisé) sans inventer un usage non sourcé.
- Il liste qui délivre le formulaire et quand on l'utilise.
- Il marque « à vérifier » si le bon formulaire dépend d'une date ou d'une situation
  (red flag rf_formulaire_depend_date_ou_situation).
- Il renvoie toujours vers la source officielle (ONEM / organisme de paiement).
- legalWarning obligatoire.

Ne pré-remplis aucune donnée transmise à l'ONEM : l'outil prépare, il ne soumet pas.
```

---

## 3. Ajouter une nouvelle règle métier

```txt
Lis /docs/knowledge/chomage/README.md (procédure d'ajout d'une règle).

Objectif :
Ajouter la règle « <DESCRIPTION COURTE> » dans le bon fichier knowledge.

Attendus :
- Bloc YAML complet : rule_id stable, theme, effective_from, source_name, source_url,
  last_verified, confidence, status, summary, agent_instruction, red_flags,
  related_forms, related_topics.
- Si la source officielle est inconnue : source_url = TODO_SOURCE_OFFICIELLE,
  confidence = to_verify, status = to_verify.
- Référencer la règle dans RULES_INDEX.md (section du thème).
- Ne renomme jamais un rule_id existant ; une règle qui change devient deprecated et
  une nouvelle règle (nouvel id) la remplace.

N'invente aucun chiffre, durée, montant ou date non sourcé.
```

---

## 4. Vérifier une règle existante

```txt
Lis /docs/agents/chomage/SOURCE_REGISTER.md et la règle <RULE_ID> dans son fichier knowledge.

Objectif :
Vérifier que <RULE_ID> est toujours exacte et à jour.

Méthode :
- Compare le summary de la règle à la source officielle (source_url).
- Si confirmée : mets à jour last_verified (date du jour) et, si besoin, confidence.
- Si la source a changé : passe l'ancienne règle en deprecated, crée une nouvelle règle
  (nouvel rule_id) avec le nouveau contenu, et mets à jour RULES_INDEX.md.
- Si la source est introuvable / ambiguë : confidence = to_verify, et note-le.

Ne « corrige » jamais un chiffre sans source officielle à l'appui.
```

---

## 5. Créer des cas de test métier

```txt
[Amorce commune]
Lis /docs/agents/chomage/TEST_CASES.md et /docs/agents/chomage/RED_FLAGS.md.

Objectif :
Écrire des cas de test métier pour l'outil <NOM>.

Pour chaque cas, fournis :
- entrée utilisateur (ce que la personne décrit) ;
- informations connues / manquantes ;
- résultat attendu (dossier visé) + matchLevel attendu ;
- rule_id attendues ;
- phrase de prudence attendue ;
- red flags éventuels (rf_*).

Couvre au moins : un cas recommande clair, un cas pertinent (info non bloquante manquante),
et plusieurs cas a_verifier (red flags, règle non sourcée, situation hybride).
```

---

## 6. Auditer UNIQUEMENT la logique métier d'un outil chômage

```txt
Lis /docs/agents/chomage/AGENT_CHOMAGE.md, RULES_INDEX.md, QUALITY_CHECKLIST.md, RED_FLAGS.md.

Objectif :
Auditer la LOGIQUE MÉTIER de l'outil <CHEMIN/NOM> — pas le style, pas l'archi.

Vérifie :
- Chaque verdict s'appuie sur des rule_id existants et sourcés.
- La distinction avant/après 01/03/2026 est respectée.
- Les red flags produisent bien un a_verifier.
- La phrase de prudence est présente partout.
- Aucun montant n'est garanti ; les montants viennent du calculateur.
- Pas de mélange complet / temporaire / AGR / insertion.

Rends un rapport : conforme / à corriger (avec rule_id et cas concernés). Ne refactorise pas
le code applicatif ; signale seulement les écarts métier.
```

---

## 7. Refuser d'inventer une règle (rappel de discipline)

```txt
Rappel : tu es un agent d'orientation, pas une autorité.

Si on te demande une règle, un montant, une durée, une condition ou une conséquence que tu
ne trouves PAS dans /docs/knowledge/chomage/ avec une source officielle, tu NE l'inventes pas.

Tu réponds :
- ce que tu sais (sourcé) ;
- ce que tu ne peux pas confirmer ;
- où la personne obtient la réponse officielle (ONEM / organisme de paiement / régional) ;
- la phrase de prudence obligatoire.

Produire « à vérifier » est une réponse correcte et attendue.
```
