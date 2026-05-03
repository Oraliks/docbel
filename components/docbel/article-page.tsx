"use client";

import React, { useEffect, useState } from "react";
import { NewsItem } from "@/lib/docbel-data";
import { ArrowIcon } from "./icons";


interface ArticlePageProps {
  article: NewsItem;
  accent: string;
  onBack: () => void;
}

export function ArticlePage({ article, accent, onBack }: ArticlePageProps) {
  const getEmoji = (tag: string): string => {
    if (tag === "Mise à jour") return "📋";
    if (tag === "Annonce ONEM") return "🏛️";
    if (tag === "CPAS") return "✍️";
    if (tag === "Réforme") return "⚖️";
    return "🔔";
  };

  const getArticleContent = (articleId: number): string => {
    const contents: Record<number, string> = {
      1: `Depuis le 1er avril 2026, une revalorisation importante des allocations de chômage complet a été mise en place suite à l'indexation automatique des salaires.

Cette augmentation de 2,1 % s'applique à tous les chômeurs complets indemnisés. Les organismes de paiement (CAPAC, CSC, CGSLB, FGTB) ont reçu les directives pour mettre à jour automatiquement les montants versés à partir de cette date.

**Qui est concerné ?**
- Les chômeurs complets indemnisés
- Tous les régimes de prestations chômage
- Les allocations d'attente pour jeunes
- Les allocations de transition

**Montants augmentés**
Les nouveaux montants varient selon votre situation familiale :
- Chômeur isolé : augmentation de base
- Chômeur cohabitant : montant réduit avec augmentation
- Chômeur responsable de famille : montant majoré

**Démarches à effectuer**
Aucune démarche n'est nécessaire de votre part. Les organismes de paiement mettent automatiquement à jour vos allocations. Vous devez cependant continuer à remplir vos obligations de demandeur d'emploi.`,
      2: `L'Office National de l'Emploi (ONEM) a annoncé des changements importants concernant l'introduction en ligne de la demande d'allocations de chômage (C1).

À partir du 1er mai 2026, le délai pour introduire votre demande C1 passe de 8 mois à 12 mois après votre fin de travail. Cette mesure facilite grandement les procédures administratives pour les primo-demandeurs.

**Les nouvelles modalités**
- Délai d'introduction allongé à 12 mois
- Possibilité d'introduire entièrement via MyONEM
- Simplification de la démarche administrative
- Moins de documents papier requis

**Procédure simplifiée**
1. Accédez à MyONEM avec vos identifiants
2. Remplissez le formulaire C1 en ligne
3. Téléchargez les documents requis
4. Validez votre demande
5. Recevez une confirmation par email

**Avantages de la demande en ligne**
- Pas de déplacement nécessaire
- Traitement plus rapide
- Conservation de l'historique
- Suivi en temps réel de votre dossier

L'ONEM met à disposition une aide en ligne et des tutoriels vidéo pour vous guider à chaque étape de la procédure.`,
      3: `Le Service Public de Programmation (SPP) Intégration sociale a confirmé l'extension temporaire du revenu d'intégration sociale (RIS) pour les chômeurs en fin de droits.

Cette mesure, qui était initialement prévue jusqu'à la fin du premier trimestre 2026, a été prolongée jusqu'à fin 2026 pour soutenir les personnes en difficulté financière.

**Qui peut en bénéficier ?**
- Les chômeurs ayant épuisé leurs droits aux allocations
- Les personnes sans autres revenus
- Les résidents belges légaux
- Les personnes ayant une situation de besoin

**Montant du RIS**
Le revenu d'intégration sociale offre un minimum de revenus garantis :
- Isolé : montant de base
- Cohabitant : montant réduit
- Responsable de famille : montant majoré
- Avec enfant à charge : suppléments possibles

**Démarches auprès du CPAS**
1. Contactez votre CPAS local
2. Constituez votre dossier
3. Présentez votre demande
4. Participez à un entretien social
5. Recevez votre avis de décision

**Obligations liées au RIS**
- Chercher activement un emploi
- Participer aux projets du CPAS
- Respecter les conditions de suivi social
- Signaler tout changement de situation`,
      4: `Une réforme majeure des délais de préavis a été adoptée par le Parlement belge, suite à la loi du 12 mars 2026. Ces nouvelles dispositions s'appliqueront à tous les nouveaux contrats de travail conclus après le 1er mai 2026.

**Principaux changements**
Les délais de préavis ont été entièrement révisés pour refléter les mutations du marché du travail contemporain.

**Nouvelle grille de préavis**
- 0 à 2 ans : 2 semaines
- 2 à 5 ans : 4 semaines
- 5 à 10 ans : 8 semaines
- Plus de 10 ans : 12 semaines

**Éléments pris en compte**
- Ancienneté totale de carrière
- Périodes d'interruption justifiées
- Formations suivies
- Promotions internes
- Congés parental/thématique

**Calcul de l'ancienneté**
Les interruptions de carrière (congé parental, sabbatique autorisé, congé thématique) sont désormais intégrés dans le calcul de l'ancienneté. Cela signifie que vos droits sont préservés même pendant ces périodes.

**Transitoire**
- Les contrats avant le 1er mai 2026 : ancienne loi
- Les contrats après le 1er mai 2026 : nouvelle loi
- Application individuelle selon le contrat`,
    };
    return contents[articleId] || "Contenu de l'article non disponible.";
  };

  return (
    <div className="px-10 py-10 max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="bg-transparent border-none text-[var(--accent)] cursor-pointer text-sm font-semibold mb-8 p-0 flex items-center gap-2 transition-opacity hover:opacity-70"
        style={{ "--accent": accent } as React.CSSProperties}
      >
        <div className="inline-flex rotate-180">
          <ArrowIcon size={16} />
        </div>
        Retour aux actualités
      </button>

      {/* Article Header */}
      <div className="mb-6">
        <div
          className="inline-block text-xs font-semibold tracking-wider py-1 px-2 rounded text-uppercase mb-4"
          style={{ color: article.color, background: `${article.color}12` }}
        >
          {article.tag}
        </div>

        <h1 className="text-4xl font-black text-foreground leading-tight m-0 mb-4 -tracking-0.5">
          {article.title}
        </h1>

        <div className="flex gap-6 items-center pb-6 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs">📅</span>
            <span className="text-sm text-muted-foreground">{article.date}</span>
          </div>
          {article.readingTime && (
            <div className="flex items-center gap-2">
              <span className="text-xs">⏱️</span>
              <span className="text-sm text-muted-foreground">
                {article.readingTime} min de lecture
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Article Image */}
      <div
        className="w-full h-80 rounded-lg flex items-center justify-center mb-9 overflow-hidden flex-shrink-0"
        style={{ background: `${article.color}15`, border: `1px solid ${article.color}25` }}
      >
        {article.image ? (
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const div = (e.target as HTMLImageElement).parentElement;
              if (div) {
                div.style.background = `${article.color}15`;
                div.style.border = `1px solid ${article.color}25`;
                div.innerHTML = `<div style="font-size: 64px">${getEmoji(article.tag)}</div>`;
              }
            }}
          />
        ) : (
          <div className="text-6xl">
            {getEmoji(article.tag)}
          </div>
        )}
      </div>

      {/* Article Content */}
      <div className="text-foreground mb-10">
        {article.content && article.content.length > 0 ? (
          article.content.includes("<") ? (
            <div
              dangerouslySetInnerHTML={{ __html: article.content }}
              className="article-content text-foreground"
            />
          ) : (
            article.content.split("\n\n").map((paragraph, idx) => {
              const parts = paragraph.split(/\*\*(.*?)\*\*/);
              return (
                <p key={idx} className="mb-4 text-foreground">
                  {parts.map((part, i) =>
                    i % 2 === 1 ? (
                      <strong key={i} className="font-bold text-foreground">{part}</strong>
                    ) : part
                  )}
                </p>
              );
            })
          )
        ) : (
          getArticleContent(typeof article.id === "number" ? article.id : 0)
            .split("\n\n")
            .map((paragraph, idx) => {
              const parts = paragraph.split(/\*\*(.*?)\*\*/);
              return (
                <p
                  key={idx}
                  className={paragraph.startsWith("**") ? "mb-4 text-muted-foreground" : "mb-4 text-foreground"}
                >
                  {parts.map((part, i) =>
                    i % 2 === 1 ? (
                      <strong key={i} className="font-bold text-foreground">{part}</strong>
                    ) : part
                  )}
                </p>
              );
            })
        )}
      </div>

      {/* Share Section */}
      <div className="bg-surface rounded-lg border border-border p-6 text-center">
        <h3 className="text-base font-bold text-foreground m-0 mb-3">
          Trouvez cette information utile ?
        </h3>
        <p className="text-sm text-muted-foreground m-0 mb-4">
          Partagez cette article avec votre réseau ou contactez-nous pour plus de précisions.
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg border-none bg-[var(--accent)] text-white text-sm font-semibold cursor-pointer transition-opacity hover:opacity-85"
          style={{ "--accent": accent } as React.CSSProperties}
        >
          ← Retour aux actualités
        </button>
      </div>
    </div>
  );
}
