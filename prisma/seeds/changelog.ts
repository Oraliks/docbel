import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const entries = [
  {
    version: "v0.1.0",
    publishedAt: new Date("2022-11-18"),
    type: "feature",
    title: "Premières réflexions autour de Docbel",
    description:
      "Les premières idées du projet prennent forme : créer une plateforme capable de rendre l'administratif belge plus simple, plus clair et plus accessible.",
    changes: [
      "Définition des premiers objectifs du projet",
      "Réflexion autour d'un site centralisant informations, outils et démarches",
      "Premières recherches sur les besoins des citoyens face à l'administratif",
    ],
  },
  {
    version: "v0.2.0",
    publishedAt: new Date("2022-12-27"),
    type: "improvement",
    title: "Une vision plus claire pour la plateforme",
    description:
      "L'idée de Docbel se précise : ne pas seulement expliquer l'administratif, mais aider concrètement les utilisateurs à trouver les bonnes informations et à avancer dans leurs démarches.",
    changes: [
      "Structuration des grandes sections imaginées pour le site",
      "Premières pistes autour des outils pratiques",
      "Réflexion sur l'automatisation de certaines démarches",
    ],
  },
  {
    version: "v0.3.0",
    publishedAt: new Date("2023-02-14"),
    type: "feature",
    title: "Début de la création du site",
    description:
      "Le développement de Docbel commence réellement avec une première base du site pensée pour accueillir, à terme, des contenus, des outils et des services administratifs utiles.",
    changes: [
      "Création des premières pages du projet",
      "Mise en place d'une navigation initiale",
      "Début de la construction d'un espace citoyen",
    ],
  },
  {
    version: "v0.4.0",
    publishedAt: new Date("2023-04-03"),
    type: "feature",
    title: "Premiers contenus administratifs",
    description:
      "Les premières informations sont ajoutées afin d'expliquer plus simplement certaines démarches et certains organismes belges.",
    changes: [
      "Ajout des premières pages d'aide",
      "Début des contenus liés aux démarches administratives",
      "Premières explications accessibles au grand public",
    ],
  },
  {
    version: "v0.5.0",
    publishedAt: new Date("2023-06-22"),
    type: "feature",
    title: "Premiers outils imaginés pour les citoyens",
    description:
      "Docbel commence à évoluer au-delà d'un simple site d'information, avec les premières idées d'outils capables d'accompagner les utilisateurs dans leurs démarches.",
    changes: [
      "Réflexion autour des calculateurs pratiques",
      "Premiers essais d'outils liés aux documents administratifs",
      "Début d'une approche plus interactive",
    ],
  },
  {
    version: "v0.6.0",
    publishedAt: new Date("2023-10-09"),
    type: "improvement",
    title: "Réorganisation du projet",
    description:
      "Après plusieurs mois d'avancée plus progressive, le projet est revu pour mieux préparer son développement futur et clarifier sa direction.",
    changes: [
      "Reprise de l'organisation générale du site",
      "Clarification des rubriques principales",
      "Préparation d'une plateforme plus complète",
    ],
  },
  {
    version: "v0.7.0",
    publishedAt: new Date("2023-12-19"),
    type: "feature",
    title: "Docbel devient un vrai projet de centralisation",
    description:
      "La vision s'élargit : regrouper au même endroit les outils, les guides, les documents et les informations qui peuvent simplifier l'administratif belge.",
    changes: [
      "Élargissement du périmètre du projet",
      "Début d'une logique de centralisation des ressources",
      "Préparation des futurs espaces outils et guides",
    ],
  },
  {
    version: "v0.8.0",
    publishedAt: new Date("2024-03-11"),
    type: "feature",
    title: "Premiers guides pratiques",
    description:
      "De nouveaux contenus sont préparés pour expliquer certaines démarches étape par étape, dans un langage plus simple.",
    changes: [
      "Début des guides administratifs",
      "Contenus pensés pour accompagner les utilisateurs",
      "Amélioration de la pédagogie des pages",
    ],
  },
  {
    version: "v0.9.0",
    publishedAt: new Date("2024-05-28"),
    type: "feature",
    title: "Premiers essais autour des documents",
    description:
      "Le projet explore la possibilité d'aider les utilisateurs à compléter plus facilement certains documents administratifs.",
    changes: [
      "Premières réflexions sur les documents à pré-remplir",
      "Tests sur des parcours guidés",
      "Préparation de fonctionnalités d'assistance",
    ],
  },
  {
    version: "v0.10.0",
    publishedAt: new Date("2024-08-17"),
    type: "improvement",
    title: "Une navigation progressivement améliorée",
    description:
      "Plusieurs ajustements sont apportés pour rendre la plateforme plus claire et faciliter l'accès aux différentes informations.",
    changes: [
      "Réorganisation de certaines sections",
      "Amélioration du parcours de lecture",
      "Pages rendues plus simples à parcourir",
    ],
  },
  {
    version: "v0.11.0",
    publishedAt: new Date("2024-11-04"),
    type: "feature",
    title: "Début du glossaire administratif",
    description:
      "Un espace dédié aux termes parfois difficiles de l'administratif belge commence à être préparé afin de mieux accompagner les utilisateurs.",
    changes: [
      "Création des premières entrées du glossaire",
      "Explications simples de notions administratives",
      "Volonté de rendre les acronymes plus compréhensibles",
    ],
  },
  {
    version: "v1.0.0",
    publishedAt: new Date("2025-02-13"),
    type: "breaking",
    title: "Le projet est repensé sur de nouvelles bases",
    description:
      "Docbel est revu en profondeur pour devenir une plateforme plus ambitieuse, plus claire et mieux préparée aux futures fonctionnalités.",
    changes: [
      "Reconstruction progressive de la structure du site",
      "Nouvelle organisation des contenus et outils",
      "Préparation d'une expérience plus cohérente pour les utilisateurs",
    ],
  },
  {
    version: "v1.1.0",
    publishedAt: new Date("2025-04-29"),
    type: "feature",
    title: "Développement des profils utilisateurs",
    description:
      "Les bases d'un espace personnel sont ajoutées afin de permettre, à terme, de simplifier certaines démarches grâce aux informations déjà connues de l'utilisateur.",
    changes: [
      "Début de l'espace profil",
      "Préparation du pré-remplissage de documents",
      "Réflexion autour d'une expérience plus personnalisée",
    ],
  },
  {
    version: "v1.2.0",
    publishedAt: new Date("2025-08-21"),
    type: "feature",
    title: "Début du localisateur de bureaux",
    description:
      "Le projet avance vers un outil capable d'aider chacun à retrouver plus facilement les organismes et bureaux utiles selon sa situation.",
    changes: [
      "Premières bases du localisateur",
      "Réflexion autour des communes, CPAS, syndicats et autres organismes",
      "Volonté de regrouper les recherches sur une seule page",
    ],
  },
  {
    version: "v1.2.1",
    publishedAt: new Date("2025-10-06"),
    type: "improvement",
    title: "Une recherche d'informations plus ambitieuse",
    description:
      "Docbel se prépare à rendre l'accès aux contenus plus rapide, avec une recherche capable de couvrir davantage de guides, d'outils et de ressources.",
    changes: [
      "Préparation d'une recherche plus globale",
      "Organisation des contenus pour les retrouver plus facilement",
      "Amélioration progressive de l'accès à l'information",
    ],
  },
  {
    version: "v1.3.0",
    publishedAt: new Date("2025-12-31"),
    type: "breaking",
    title: "Un site entièrement repensé",
    description:
      "Le site a été revu de A à Z afin d'offrir une expérience plus moderne, plus claire et plus agréable au quotidien.\n\nAu-delà du nouveau design, toute la structure du site a été retravaillée pour rendre la navigation plus simple, les pages plus lisibles et l'accès à l'information plus rapide. Les contenus sont mieux organisés, les outils plus faciles à trouver, et l'ensemble s'adapte mieux à tous les écrans, sur ordinateur comme sur mobile.",
    changes: [
      "Nouvelle identité visuelle",
      "Navigation repensée",
      "Pages mieux organisées",
      "Expérience plus fluide sur ordinateur et mobile",
    ],
  },
  {
    version: "v1.4.0",
    publishedAt: new Date("2026-04-18"),
    type: "feature",
    title: "Un glossaire pour mieux comprendre",
    description:
      "Un nouveau glossaire rassemble les principaux termes et notions utiles, avec des explications simples et accessibles.",
    changes: [
      "Ajout d'un espace dédié aux définitions",
      "Explication des principaux termes administratifs",
      "Aide à la compréhension des notions parfois complexes",
    ],
  },
  {
    version: "v1.4.1",
    publishedAt: new Date("2026-04-19"),
    type: "improvement",
    title: "Un espace blog et actualités",
    description:
      "Une nouvelle section permet de suivre les dernières informations, nouveautés et contenus utiles publiés sur le site.",
    changes: [
      "Ajout d'un espace actualités",
      "Publication de contenus utiles et nouveautés",
      "Meilleur suivi des évolutions administratives importantes",
    ],
  },
  {
    version: "v1.4.2",
    publishedAt: new Date("2026-04-26"),
    type: "improvement",
    title: "Une recherche globale plus rapide",
    description:
      "Une nouvelle barre de recherche permet désormais de retrouver facilement un guide, une loi, un document ou une information disponible sur le site.\n\nTout est accessible en quelques frappes, sans devoir parcourir les différentes rubriques une par une.",
    changes: [
      "Recherche accessible rapidement depuis le site",
      "Accès simplifié aux guides, documents et informations",
      "Navigation plus directe vers les contenus utiles",
    ],
  },
  {
    version: "v1.4.3",
    publishedAt: new Date("2026-05-02"),
    type: "fix",
    title: "Un nouveau design, plus clair et plus agréable",
    description:
      "Le site a été entièrement repensé pour offrir une navigation plus simple, un affichage plus moderne et une lecture plus confortable.\n\nLes contenus sont mieux organisés, les pages plus agréables à parcourir, et l'expérience a été améliorée sur ordinateur comme sur mobile.",
    changes: [
      "Ajustements visuels sur l'ensemble du site",
      "Meilleure lisibilité des pages",
      "Parcours utilisateur plus agréable",
    ],
  },
  {
    version: "v1.4.4",
    publishedAt: new Date("2026-05-12"),
    type: "feature",
    title: "Trouvez vos bureaux en quelques secondes",
    description:
      "Tous vos bureaux utiles sont désormais regroupés sur une seule page : CPAS, commune, ONEM, organisme de paiement, syndicat, mutuelle, etc.\n\nUne seule recherche suffit, via /outils/bureaux.",
    changes: [
      "Recherche de bureaux depuis une seule page",
      "Accès simplifié aux organismes utiles",
      "Recherche par adresse, code postal ou nom de bureau",
      "Résultats plus faciles à comprendre",
    ],
  },
];

async function main() {
  console.log(`🌱 Seeding ${entries.length} changelog entries...`);
  let created = 0;
  let updated = 0;

  for (const entry of entries) {
    const existing = await prisma.changelog.findUnique({
      where: { version: entry.version },
      select: { id: true },
    });

    await prisma.changelog.upsert({
      where: { version: entry.version },
      update: {
        publishedAt: entry.publishedAt,
        type: entry.type,
        title: entry.title,
        description: entry.description,
        changes: entry.changes,
        updatedBy: "seed",
      },
      create: {
        version: entry.version,
        publishedAt: entry.publishedAt,
        type: entry.type,
        title: entry.title,
        description: entry.description,
        changes: entry.changes,
        createdBy: "seed",
      },
    });

    if (existing) {
      updated++;
      console.log(`   ~ updated: ${entry.version} — ${entry.title}`);
    } else {
      created++;
      console.log(`   ✓ created: ${entry.version} — ${entry.title}`);
    }
  }

  console.log(`\nDone. ${created} created, ${updated} updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
