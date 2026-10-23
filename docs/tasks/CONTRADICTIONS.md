# Contradictions et décisions courantes

## Référence historique

Les constats et arbitrages détaillés de juin sont conservés intégralement dans
[l'historique de cette note](../archive/CONTRADICTIONS_HISTORY_2026-10-23.md), avec
les liens vers les [audits techniques](../archive/AUDIT_TECH_2026-05-29.md) et
[RGPD](../archive/AUDIT_RGPD_2026-06-06.md). Les remplacements, preuves datées et
restes uniques sont indexés dans [CLEANUP_QUEUE](CLEANUP_QUEUE.md). Les consignes
actuelles du dépôt et les queues spécialisées prévalent sur les recommandations
datées des audits et plans archivés.

## Décisions propriétaire en vigueur — 23/10/2026

- Échéance visée : **23/11/2026**.
- Projet exercé à titre personnel, sans société déclarée.
- Phase publique décidée : consultation et utilisation des outils sans compte
  visiteur ni dossier enregistré. Cette phase de fermeture est temporaire ; les
  fonctions et données existantes sont conservées pour la réouverture ultérieure.
- L'administration privée reste utilisable. L'arbre familial approuvé reste inchangé.
- La finalisation RGPD et la réouverture sont reportées. Leur report ne vaut pas
  preuve que toutes les collectes sont désactivées.

Sources de suivi : [MVP_SCOPE](MVP_SCOPE.md), [NEXT_ACTIONS](NEXT_ACTIONS.md),
[RGPD_QUEUE](RGPD_QUEUE.md) et DECISIONS_V1 (`docs/operations/DECISIONS_V1.md`).
Les informations légales et coordonnées encore à fournir restent ouvertes dans
DECISIONS_V1 ; cette synthèse ne les tranche pas.

## Points techniques déjà suivis

Les désaccords historiques sur la sanitisation HTML et le cookie de reprise sont
consignés comme clos dans [SECURITY_QUEUE](SECURITY_QUEUE.md). Les autres constats
techniques et leur statut se trouvent dans cette queue et TECH_DEBT_QUEUE. Le README
et AGENTS.md portent les consignes applicables, notamment l'interdiction de
`prisma db push` sur la base partagée.

Cette note résume les décisions communiquées et renvoie aux preuves ; elle ne
revendique ni audit actuel du code ni conformité juridique complète.
