# OUTPUT_SCHEMAS — Contrat de sortie des outils chômage

> **Ces types sont des recommandations.** Ils n'ont pas à être implémentés tout de suite.
> Ils servent de **contrat commun** pour les futurs outils chômage (wizards, formulaires,
> arbres de décision) afin que tous produisent une sortie homogène, prudente et traçable.
>
> Si un outil les implémente, il doit rester compatible avec
> [`AGENT_CHOMAGE.md`](AGENT_CHOMAGE.md) : `legalWarning` obligatoire, `matchLevel` honnête,
> `ruleIdsUsed` réels, `a_verifier` possible.

---

## Types recommandés

```ts
/** Niveau de correspondance d'un résultat avec la situation décrite. */
export type MatchLevel = "recommande" | "pertinent" | "a_verifier";

/** Niveau de confiance d'une règle métier (voir le format YAML des règles). */
export type RuleConfidence =
  | "official"   // lu directement sur une source institutionnelle
  | "high"       // recoupé par au moins deux sources officielles
  | "medium"     // partiellement confirmé
  | "low"        // indice faible, à confirmer
  | "to_verify"; // non confirmé — ne peut pas fonder une conclusion ferme

/** Une source officielle citée dans un résultat. */
export interface DocbelOfficialSource {
  title: string;
  institution: string;            // ONEM, CAPAC, Actiris, Forem, VDAB, ADG, SPF…
  url: string | null;             // null si TODO_SOURCE_OFFICIELLE
  lastVerified: string | null;    // ISO date ou null
  confidence: RuleConfidence;
}

/** Résultat produit par un outil d'orientation chômage. */
export interface DocbelWizardResult {
  dossierSlug: string | null;     // slug du dossier Docbel ciblé, ou null
  dossierTitle: string;
  matchLevel: MatchLevel;
  rationale: string;              // justification interne / pour l'affichage
  userExplanation: string;        // explication vulgarisée pour l'utilisateur
  requiredInfo: string[];         // infos manquantes qui changent le résultat
  probableDocuments: string[];    // documents/formulaires probables
  officialSources: DocbelOfficialSource[];
  legalWarning: string;           // phrase de prudence OBLIGATOIRE
  ruleIdsUsed: string[];          // rule_id réellement utilisées (doivent exister)
  redFlags: string[];             // red flags déclenchés (voir RED_FLAGS.md)
}

/** Une question d'un wizard / arbre de décision. */
export interface DocbelQuestion {
  id: string;
  label: string;
  helperText?: string;
  type:
    | "single_choice"
    | "multiple_choice"
    | "date"
    | "number"
    | "text"
    | "boolean";
  required: boolean;
  options?: DocbelQuestionOption[];
}

/** Une option de réponse, éventuellement branchante. */
export interface DocbelQuestionOption {
  value: string;
  label: string;
  description?: string;
  nextQuestionId?: string;        // branchement vers une autre question
  resultId?: string;              // ou directement vers un résultat
}

/** Définition complète d'un wizard / arbre de décision chômage. */
export interface DocbelWizardDefinition {
  id: string;
  title: string;
  description: string;
  version: string;                // ex. "1.0.0"
  lastUpdated: string;            // ISO date
  ruleIdsUsed: string[];          // toutes les rule_id mobilisées par ce wizard
  questions: DocbelQuestion[];
  results: DocbelWizardResult[];
}
```

---

## Comment utiliser ce contrat

- **`legalWarning`** : toujours rempli avec la phrase de prudence obligatoire
  (cf. [`AGENT_CHOMAGE.md` §10](AGENT_CHOMAGE.md)).
- **`matchLevel: "a_verifier"`** est un état **valide**, à privilégier dès qu'une info
  critique manque, qu'un red flag se déclenche, ou qu'une règle est `to_verify`.
- **`ruleIdsUsed`** ne doit contenir que des `rule_id` existants (présents dans un fichier
  `knowledge/` et listés dans [`RULES_INDEX.md`](RULES_INDEX.md)).
- **`officialSources`** : si l'URL exacte est inconnue, mettre `url: null` et
  `confidence: "to_verify"` plutôt qu'une URL inventée.
- **`requiredInfo`** : reprend le vocabulaire de l'étape 3 de l'ordre de raisonnement
  (âge, région, organisme de paiement, situation familiale, dates…).

### Relation avec l'existant
- Les **montants** ne transitent pas par ce schéma : ils viennent du moteur
  [`lib/calculators/chomage.ts`](../../../lib/calculators/chomage.ts).
- Un outil eC3.2 réutilise les types de [`lib/ec32/`](../../../lib/ec32) (schéma Zod) ;
  ce contrat sert à l'**orientation** autour, pas au simulateur lui-même.
- Rien n'oblige à créer une nouvelle table : un wizard peut être défini en données
  (cf. Decision Builder / page-builder) ou en code, tant que la sortie respecte ce contrat.
