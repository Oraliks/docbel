# Glossaire terminologique i18n — Beldoc

> **But :** source de vérité terminologique pour les traducteurs (humains + pipeline IA).
> Injecté dans le system prompt de Claude pour garantir la **cohérence** et éviter
> la traduction littérale d'un vocabulaire administratif belge qui n'a souvent
> **aucun équivalent** dans les langues cibles (AR, TR, RO, BG…).
>
> **Statut :** PREMIER JET REMPLI — gloses proposées par Claude, **à valider par Oraliks**.
> Les ⚠️ marquent les termes où j'ai un doute (voir liste en fin de doc).
> **Source :** seedé depuis `lib/acronyms.ts` (31 sigles ✓) + ajouts.

## Mode d'emploi

Chaque terme porte une **stratégie de traduction** + une **glose figée FR** (l'explication
courte, écrite une fois, reprise telle quelle dans chaque langue).

| Stratégie | Sens |
|---|---|
| 🟢 **TRADUIRE** | Concept universel, équivalent direct (salaire, facture, TVA) |
| 🟡 **TRADUIRE + GLOSE** | Équivalent approchant + précision belge entre parenthèses |
| 🔴 **GARDER + EXPLIQUER** | Terme belge sans équivalent → garder l'original + glose |

**Convention institutions 🔴 :** NL/DE utilisent le **nom officiel local** (colonne *Note*) ;
seules EN/AR/TR/RO/BG gardent le terme FR + la glose.

- ✓ = déjà dans `lib/acronyms.ts` · ⚠️ = à valider (impact sur un droit/taux)

---

## A. Institutions & organismes  🔴

| Terme | Strat. | Glose figée FR | Note |
|---|---|---|---|
| **ONEM** | 🔴 | administration fédérale belge du chômage | NL: RVA · DE: LfA · ✓ |
| **CAPAC** | 🔴 | caisse publique qui paie les allocations de chômage | NL: HVW · ✓ |
| **CPAS** | 🔴 | service social de la commune (revenu minimum, aides) | NL: OCMW · DE: ÖSHZ · ✓ |
| **FOREM** | 🔴 | service public de l'emploi en Wallonie | nom propre, garder partout · ✓ |
| **VDAB** | 🔴 | service public de l'emploi en Flandre | nom propre · ✓ |
| **Actiris** | 🔴 | service public de l'emploi à Bruxelles | nom propre · ✓ |
| **ADG** | 🔴 | service public de l'emploi en région germanophone | nom propre · ✓ |
| **ONSS** | 🔴 | organisme belge des cotisations de sécurité sociale | NL: RSZ · ✓ |
| **INASTI** | 🔴 | sécurité sociale des travailleurs indépendants | NL: RSVZ · ✓ |
| **INAMI** | 🔴 | assurance maladie belge (via les mutualités) | NL: RIZIV · ✓ |
| **BCSS** | 🔴 | plateforme belge d'échange des données sociales | NL: KSZ · ✓ |
| **BCE** | 🔴 | registre belge des entreprises (numéro unique) | NL: KBO · ✓ |
| **SPF** | 🔴 | administration fédérale belge (ex. SPF Emploi) | NL: FOD · DE: FÖD · ✓ |
| **SPP** | 🔴 | administration fédérale belge spécialisée | NL: POD · ✓ |
| **ALE** | 🔴 | agence locale pour petits travaux occasionnels | NL: PWA · ✓ |
| **Organisme de paiement (OP)** | 🟡 | organisme qui verse les allocations (CAPAC ou un syndicat) | NL: uitbetalingsinstelling |
| **CSC / FGTB / CGSLB** | 🔴 | syndicats belges (qui paient aussi les allocations) | NL: ACV / ABVV / ACLVB |
| **Mutualité** | 🟡 | organisme qui rembourse les soins et verse les indemnités maladie | NL: ziekenfonds |
| **Secrétariat social** | 🟡 | prestataire qui gère la paie et les déclarations pour l'employeur | NL: sociaal secretariaat |
| **Itsme** | 🔴 | application belge d'identité numérique | nom propre |
| **Doccle** | 🔴 | coffre-fort numérique belge pour documents | nom propre |

---

## B. Documents & formulaires  🔴

| Terme | Strat. | Glose figée FR | Note |
|---|---|---|---|
| **C4** | 🔴 | document de fin de contrat, ouvre le droit au chômage | ⚠️ central · ✓ |
| **C1** | 🔴 | déclaration de situation familiale (fixe le taux) | ✓ |
| **C3 / carte de contrôle** | 🔴 | carte mensuelle des jours de travail et d'absence | C3.2A · ✓ |
| **U1 (PD U1)** | 🔴 | document européen des périodes d'emploi à l'étranger | modèle UE |
| **U2 (PD U2)** | 🔴 | autorisation d'emporter ses allocations dans un autre pays UE | modèle UE |
| **C4-ASR** | 🔴 | version électronique du C4 | ⚠️ à vérifier |
| **DIMONA** | 🔴 | déclaration de l'employeur à l'embauche | ✓ |
| **DRS** | 🔴 | déclarations électroniques liées au chômage/maladie | NL: ASR · ✓ |
| **Annexe** | 🟢 | formulaire complémentaire | |
| **Attestation** | 🟢 | document qui certifie un fait | |

---

## C. Chômage — notions clés  🟡

| Terme | Strat. | Glose figée FR | Note |
|---|---|---|---|
| **Allocation de chômage** | 🟡 | revenu versé au chômeur indemnisé | NL: werkloosheidsuitkering · ⚠️ |
| **Allocation d'insertion** | 🟡 | allocation pour les jeunes après les études | NL: inschakelingsuitkering · ⚠️ |
| **Stage d'insertion** | 🟡 | période d'attente avant l'allocation d'insertion | ⚠️ |
| **Dégressivité** | 🟡 | baisse progressive de l'allocation avec le temps | ⚠️ spécifique BE |
| **AGR** | 🔴 | complément pour travail à temps partiel involontaire | ✓ |
| **Complément d'entreprise (RCC)** | 🟡 | complément en cas de licenciement en fin de carrière | ex-« prépension » · NL: SWT · ⚠️ |
| **Chômage temporaire** | 🟡 | suspension du contrat (l'emploi est conservé) | NL: tijdelijke werkloosheid · ⚠️ |
| **Chômage complet** | 🟡 | situation où le contrat est rompu (≠ temporaire) | |
| **Dispense** | 🟡 | autorisation de ne pas devoir chercher du travail (formation…) | NL: vrijstelling |
| **Disponibilité** | 🟡 | obligation d'être disponible et de chercher un emploi | ⚠️ |
| **Contrôle de disponibilité** | 🟡 | évaluation des efforts de recherche d'emploi | régionalisé ⚠️ |
| **Exclusion / sanction** | 🟡 | suspension ou retrait des allocations | ⚠️ |
| **Période de référence** | 🟡 | période où l'on compte les jours travaillés | |
| **Jours indemnisables** | 🟡 | jours pour lesquels une allocation est due | |
| **Admissibilité** | 🟡 | conditions d'accès au droit (jours travaillés requis) | |
| **Demandeur d'emploi** | 🟢 | personne inscrite qui cherche un emploi | NL: werkzoekende |
| **Bureau de chômage (BC)** | 🔴 | antenne locale de l'ONEM | |

---

## D. Statut & situation familiale  🟡 ⚠️ (détermine le taux)

| Terme | Strat. | Glose figée FR | Note |
|---|---|---|---|
| **Isolé** | 🟡 | personne qui vit seule | NL: alleenstaande · ⚠️ taux |
| **Cohabitant** | 🟡 | personne qui vit avec d'autres et partage les frais | NL: samenwonende · ⚠️ taux |
| **Cohabitant privilégié** | 🟡 | cohabitant dont le ménage n'a aucun autre revenu | ⚠️ à valider |
| **Chef de ménage** | 🟡 | personne qui a quelqu'un à charge | NL: gezinshoofd · ⚠️ taux |
| **Charge de famille** | 🟡 | avoir à charge une personne sans revenu suffisant | ⚠️ |
| **NISS** | 🔴 | numéro national d'identité (sécurité sociale) | NL: INSZ · ✓ |

---

## E. Contrat & fin de contrat  🟡

| Terme | Strat. | Glose figée FR | Note |
|---|---|---|---|
| **Préavis** | 🟡 | délai avant la fin effective du contrat | NL: opzegtermijn · ⚠️ |
| **Indemnité de rupture** | 🟡 | somme due si le préavis n'est pas presté | NL: verbrekingsvergoeding · ⚠️ |
| **Ancienneté** | 🟡 | durée de service chez l'employeur | NL: anciënniteit |
| **Licenciement / démission** | 🟢 | rupture par l'employeur / par le travailleur | |
| **Motif grave** | 🟡 | faute justifiant un renvoi immédiat | NL: dringende reden |
| **Commission paritaire (CP)** | 🔴 | organe sectoriel qui fixe les règles de travail | numérotée (CP 124…) · ✓ |
| **CCT** | 🔴 | accord collectif d'un secteur (salaires, congés) | NL: CAO · ✓ |
| **Barème** | 🟡 | grille officielle de montants | |
| **CDI / CDD / intérim** | 🟡 | contrat à durée indéterminée / déterminée / travail temporaire | |

---

## F. CPAS & aide sociale  🟡 / 🔴

| Terme | Strat. | Glose figée FR | Note |
|---|---|---|---|
| **RIS** | 🔴 | revenu minimum mensuel versé par le CPAS | NL: leefloon · ⚠️ · ✓ |
| **PIIS** | 🔴 | contrat d'objectifs entre le CPAS et le bénéficiaire | NL: GPMI · ✓ |
| **Aide sociale** | 🟡 | aides du CPAS au-delà du revenu minimum | |
| **Aide médicale urgente** | 🟡 | prise en charge de soins pour personnes sans couverture | ⚠️ |
| **Enquête sociale** | 🟡 | examen de la situation par le CPAS | |

---

## G. Rémunération & fiscal  🟢 / 🟡

| Terme | Strat. | Glose figée FR | Note |
|---|---|---|---|
| **Salaire brut / net** | 🟢 | avant / après cotisations et impôt | |
| **Précompte professionnel** | 🟡 | avance d'impôt prélevée sur le salaire | NL: bedrijfsvoorheffing · ⚠️ |
| **Cotisations sociales** | 🟢 | prélèvements qui financent la sécurité sociale | |
| **Pécule de vacances** | 🟡 | rémunération liée aux congés payés | NL: vakantiegeld |
| **Prime de fin d'année** | 🟡 | « 13e mois » selon le secteur | |
| **TVA** | 🟢 | taxe sur la valeur ajoutée (21%) | NL: btw · ✓ |
| **Workbonus** | 🟡 | réduction de cotisations pour les bas salaires | NL: werkbonus |
| **ATN** | 🔴 | avantage en nature imposable (voiture, GSM…) | NL: VAA |

---

## H. Cadre juridique & territorial  (mixte)

| Terme | Strat. | Glose figée FR | Note |
|---|---|---|---|
| **AR** | 🔴 | texte de loi signé par le Roi | NL: KB · ✓ |
| **AM** | 🔴 | texte de loi signé par un ministre | NL: MB |
| **Moniteur belge** | 🔴 | journal officiel des lois belges | NL: Belgisch Staatsblad |
| **Région** | 🟡 | Wallonie / Flandre / Bruxelles-Capitale | noms propres = garder |
| **Communauté germanophone** | 🔴 | cantons de l'Est (germanophones) | NL: Duitstalige Gemeenschap |
| **Commune** | 🟡 | plus petite entité administrative locale | NL: gemeente |
| **Code postal** | 🟢 | 4 chiffres qui désignent une commune | |

---

## I. Emploi & vie sociale — généraux  🟢 / 🟡

| Terme | Strat. | Glose figée FR | Note |
|---|---|---|---|
| **Travailleur** | 🟢 | personne salariée | |
| **Employeur** | 🟢 | personne ou entreprise qui emploie | |
| **Indépendant** | 🟡 | personne qui travaille à son compte | NL: zelfstandige |
| **Allocations familiales** | 🟡 | aide mensuelle pour les enfants à charge | NL: kinderbijslag / Flandre: Groeipakket · ⚠️ régionalisé |
| **Incapacité de travail** | 🟡 | période où l'on ne peut pas travailler pour raison médicale | NL: arbeidsongeschiktheid |
| **Pension** | 🟢 | revenu après la fin de la carrière | |
| **Congé** | 🟢 | jours d'absence autorisés | |

---

## À valider par Oraliks (les ⚠️ — le reste est sûr)

**Termes où ma glose peut être imprécise (ton domaine) :**
1. **Complément d'entreprise (RCC)** — j'évite « prépension » (obsolète). Glose ok ?
2. **Allocation d'insertion / stage d'insertion** — formulation des conditions/durée.
3. **C4-ASR** — nom et définition exacts à confirmer.
4. **Dégressivité** — glose assez claire pour un non-initié ?
5. **Chômage temporaire** — faut-il citer les types (économique, intempéries, force majeure) ?
6. **Disponibilité / contrôle / exclusion** — c'est régionalisé : on le mentionne ?
7. **Statut familial** (isolé / cohabitant / cohabitant privilégié / chef de ménage) — gloses qui touchent **directement le taux** : à relire avec soin.
8. **Préavis / indemnité de rupture** — gloses ok pour un public non-juriste ?
9. **Allocations familiales** — régionalisé (Groeipakket en Flandre) : comment formuler ?

**2 décisions transverses :**
- **SPF** : j'ai mis « administration fédérale belge » (plutôt que « ministère »). Ok ?
- **Noms propres régionaux** (FOREM/VDAB/Actiris/ADG) : gardés tels quels dans **toutes** les langues, glose seulement. Confirmé ?

**Cible :** ~99 termes ici → viser 120-150 (j'en ajouterai au fil des besoins réels du contenu).
