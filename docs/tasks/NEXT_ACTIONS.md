# Prochaines actions DocBel

## État de coordination — 23/10/2026

Échéance maintenue au **23/11/2026**. Le propriétaire demande de terminer et
clôturer les travaux déjà ouverts avant tout nouveau chantier. Le dernier état
communiqué par le chef le 23/10 indique que les PR #86, #87, #88 et #89 sont
fusionnées dans la livraison de main `1d9d6474`, disponible en production, et
qu'aucune PR n'était ouverte à son dernier contrôle. Voir les [PR #86](https://github.com/Oraliks/docbel/pull/86),
[#87](https://github.com/Oraliks/docbel/pull/87), [#88](https://github.com/Oraliks/docbel/pull/88)
et [#89](https://github.com/Oraliks/docbel/pull/89). Ce checkout documentaire local
est resté sur `codex/article-110-consolidation` à `88d6eed9` ; le statut distant
ci-dessus est celui rapporté par le chef, pas une vérification faite depuis ce checkout.

| Lot clôturé | Résultat rapporté | Limite à conserver |
| --- | --- | --- |
| Fermetures temporaires et transition | PR #86 ; règles d'accès et fermetures livrées en production | Les fonctions temporaires et données existantes sont conservées pour la réouverture ultérieure |
| Design | PR #87 fusionnée et disponible en production | Aucune revendication de recette visuelle exhaustive de tous les appareils |
| Famille et Aa | PR #88 fusionnée et disponible en production | Arbre métier approuvé inchangé |
| Liens et routes | PR #89 fusionnée et disponible en production | 46 motifs publics qualifiés (rendu, alias, protection, indisponibilité), pas tous états, sessions, langues, URLs ou contenus CMS |

## Situation et suites

- La phase temporaire de consultation et d'outils sans compte visiteur ni dossier
  enregistré est décidée dans [MVP_SCOPE](MVP_SCOPE.md). L'administration privée
  reste utilisable.
- Les pages accessibilité, mentions légales et confidentialité restent absentes ;
  leurs liens ont été retirés. Les modules Formations sont masqués.
- La finalisation RGPD et la réouverture des fonctions restent reportées. Leur report
  ne prouve pas que les collectes ou traitements concernés sont éteints ; voir
  [RGPD_QUEUE](RGPD_QUEUE.md) et DECISIONS_V1 (`docs/operations/DECISIONS_V1.md`).
- Aucun travail produit nouveau n'est mandaté ici. Le contrat familial reste protégé.
  Cette note ne revendique ni conformité juridique complète ni couverture exhaustive
  du site.

L'ancienne chronologie détaillée est conservée telle quelle dans
[NEXT_ACTIONS_HISTORY_2026-10-23](../archive/NEXT_ACTIONS_HISTORY_2026-10-23.md).
Les preuves datées antérieures restent dans RELEASE_2026-09-27 (`docs/operations/RELEASE_2026-09-27.md`),
FOLLOWUP_2026-09-27 (`docs/operations/FOLLOWUP_2026-09-27.md`) et les rapports liés par
les queues spécialisées ; elles ne remplacent pas la preuve de la livraison d'octobre.

Le nettoyage documentaire courant, avec les deux audits archivés, les liens et les
restes uniques préservés, est suivi dans [CLEANUP_QUEUE](CLEANUP_QUEUE.md).
