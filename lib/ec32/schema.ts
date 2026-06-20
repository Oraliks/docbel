// =====================================================================
//  eC3.2 — Schéma Zod du contenu éditable (source de vérité du builder)
// ---------------------------------------------------------------------
//  Définit la forme de TOUS les textes modifiables depuis le page-builder
//  pour la page /onem/ec32. Server-safe (pur Zod, pas de React). Le type
//  `Ec32Content` est dérivé de ce schéma et consommé partout (composants,
//  contenu par défaut, fichiers de données).
//
//  Convention (Zod v4) : chaque feuille/array a un `.default(...)` et chaque
//  OBJET un `.prefault({})` — en v4 `.default` ne re-parse pas sa valeur,
//  alors que `.prefault` parse le fallback à travers le schéma (deep-fill).
//  Ainsi `ec32BlockSchema.parse({})` renvoie un squelette complet — robuste
//  face à un bloc enregistré partiel.
// =====================================================================

import { z } from 'zod'
import {
  EC32_EMPLOYER_TYPES,
  EC32_SITUATION_TYPES,
} from './types'

// ─────────────────────────── Sous-schémas réutilisables ───────────────────────────

const ec32SituationSchema = z.object({
  type: z.enum(EC32_SITUATION_TYPES),
  label: z.string().max(120).default(''),
  shortLabel: z.string().max(80).default(''),
  description: z.string().max(2400).default(''),
  examples: z.array(z.string().max(400)).default([]),
  warning: z.string().max(800).default(''),
  helpDetail: z.string().max(2400).default(''),
})

const ec32ScenarioSchema = z.object({
  key: z.string().max(60).default(''),
  title: z.string().max(240).default(''),
  level: z.string().max(40).default(''),
  duration: z.string().max(40).default(''),
  context: z.string().max(1600).default(''),
  objective: z.string().max(1600).default(''),
  expectedAction: z.string().max(1600).default(''),
  feedbackCorrect: z.string().max(1600).default(''),
  feedbackError: z.string().max(1600).default(''),
  ruleRef: z.string().max(160).default(''),
})

const ec32FaqSchema = z.object({
  q: z.string().max(400).default(''),
  a: z.string().max(3000).default(''),
})

const ec32MistakeSchema = z.object({
  key: z.string().max(60).default(''),
  title: z.string().max(240).default(''),
  explanation: z.string().max(1200).default(''),
  advice: z.string().max(1200).default(''),
  /** Ancre interne (ex. `#simulateur`, `#faq`) ou URL. */
  link: z.string().max(200).default(''),
})

const ec32LearningModeSchema = z.object({
  key: z.string().max(60).default(''),
  icon: z.string().max(40).default(''),
  title: z.string().max(160).default(''),
  description: z.string().max(800).default(''),
  /** Libellé du lien d'action de la carte (ex. « Commencer »). Vide = pas de lien.
   *  L'action est dérivée de `key` : `scenarios` → onglet « Cas pratiques »,
   *  sinon → défilement vers le simulateur. */
  cta: z.string().max(80).default(''),
})

const ec32EmployerSchema = z.object({
  id: z.string().max(60).default(''),
  name: z.string().max(160).default(''),
  enterpriseNumber: z.string().max(60).default(''),
  sector: z.string().max(160).default(''),
  type: z.enum(EC32_EMPLOYER_TYPES).default('single'),
})

const ec32MonthSchema = z.object({
  /** Clé `yyyy-mm` reliant au comportement défini dans `rules.ts`. */
  key: z.string().max(20).default(''),
  label: z.string().max(80).default(''),
  statusNote: z.string().max(160).default(''),
})

const ec32ResourceSchema = z.object({
  label: z.string().max(240).default(''),
  description: z.string().max(800).default(''),
  url: z.string().max(500).default(''),
})

const ec32DerogationSchema = z.object({
  key: z.string().max(60).default(''),
  title: z.string().max(240).default(''),
  summary: z.string().max(2400).default(''),
  conditions: z.array(z.string().max(500)).default([]),
})

/** Paire clé/texte : libellés courts & notices pédagogiques du simulateur. */
const ec32KeyTextSchema = z.object({
  key: z.string().max(60).default(''),
  text: z.string().max(2400).default(''),
})

// ─────────────────────────── Simulateur ───────────────────────────

const ec32SimulatorSchema = z
  .object({
    title: z.string().max(240).default(''),
    subtitle: z.string().max(800).default(''),
    fictitiousDataNotice: z.string().max(800).default(''),
    steps: z
      .array(
        z.object({
          key: z.string().max(40).default(''),
          title: z.string().max(160).default(''),
          description: z.string().max(800).default(''),
        }),
      )
      .default([]),
    situations: z.array(ec32SituationSchema).default([]),
    employers: z.array(ec32EmployerSchema).default([]),
    months: z.array(ec32MonthSchema).default([]),
    /** Libellés courts (boutons, titres) — surchargent les valeurs par défaut codées. */
    labels: z.array(ec32KeyTextSchema).default([]),
    /** Notices pédagogiques (encadrés explicatifs) indexées par clé. */
    notices: z.array(ec32KeyTextSchema).default([]),
    coach: z
      .object({
        title: z.string().max(160).default(''),
        intro: z.string().max(1000).default(''),
        tips: z
          .array(
            z.object({
              stepKey: z.string().max(40).default(''),
              message: z.string().max(1400).default(''),
            }),
          )
          .default([]),
      })
      .prefault({}),
    correctionModal: z
      .object({
        title: z.string().max(240).default(''),
        helpText: z.string().max(1000).default(''),
        dayLabel: z.string().max(160).default(''),
        fromLabel: z.string().max(160).default(''),
        toLabel: z.string().max(160).default(''),
        reasonLabel: z.string().max(160).default(''),
        reasonPlaceholder: z.string().max(400).default(''),
        saveLabel: z.string().max(160).default(''),
        lockedMessage: z.string().max(800).default(''),
        requiredError: z.string().max(400).default(''),
      })
      .prefault({}),
    sendModal: z
      .object({
        title: z.string().max(240).default(''),
        body: z.string().max(1400).default(''),
        cancelLabel: z.string().max(160).default(''),
        confirmLabel: z.string().max(160).default(''),
        successTitle: z.string().max(240).default(''),
        successBody: z.string().max(1000).default(''),
        blockedTitle: z.string().max(240).default(''),
        blockedBody: z.string().max(1400).default(''),
      })
      .prefault({}),
    pdf: z
      .object({
        buttonLabel: z.string().max(160).default(''),
        docTitle: z.string().max(240).default(''),
        fictionMention: z.string().max(400).default(''),
        warning: z.string().max(500).default(''),
      })
      .prefault({}),
  })
  .prefault({})

// ─────────────────────────── Schéma de bloc complet ───────────────────────────

export const ec32BlockSchema = z.object({
  seo: z
    .object({
      title: z.string().max(300).default(''),
      description: z.string().max(700).default(''),
      canonical: z.string().max(300).default('/onem/ec32'),
      noIndex: z.boolean().default(false),
    })
    .prefault({}),
  hero: z
    .object({
      badge: z.string().max(160).default(''),
      title: z.string().max(320).default(''),
      subtitle: z.string().max(1200).default(''),
      primaryCta: z.string().max(160).default(''),
      secondaryCta: z.string().max(160).default(''),
      disclaimer: z.string().max(800).default(''),
    })
    .prefault({}),
  disclaimer: z
    .object({
      title: z.string().max(240).default(''),
      points: z.array(z.string().max(500)).default([]),
    })
    .prefault({}),
  alert: z
    .object({
      title: z.string().max(240).default(''),
      content: z.string().max(1400).default(''),
    })
    .prefault({}),
  learningModes: z
    .object({
      title: z.string().max(240).default(''),
      subtitle: z.string().max(800).default(''),
      modes: z.array(ec32LearningModeSchema).default([]),
    })
    .prefault({}),
  simulator: ec32SimulatorSchema,
  scenarios: z
    .object({
      title: z.string().max(240).default(''),
      subtitle: z.string().max(800).default(''),
      items: z.array(ec32ScenarioSchema).default([]),
    })
    .prefault({}),
  mistakes: z
    .object({
      title: z.string().max(240).default(''),
      subtitle: z.string().max(800).default(''),
      items: z.array(ec32MistakeSchema).default([]),
    })
    .prefault({}),
  faq: z
    .object({
      title: z.string().max(240).default(''),
      subtitle: z.string().max(800).default(''),
      items: z.array(ec32FaqSchema).default([]),
    })
    .prefault({}),
  resources: z
    .object({
      title: z.string().max(240).default(''),
      subtitle: z.string().max(800).default(''),
      intro: z.string().max(1000).default(''),
      officialButtonLabel: z.string().max(200).default(''),
      officialUrl: z.string().max(500).default(''),
      items: z.array(ec32ResourceSchema).default([]),
      note: z.string().max(800).default(''),
    })
    .prefault({}),
  derogations: z
    .object({
      title: z.string().max(240).default(''),
      subtitle: z.string().max(800).default(''),
      badge: z.string().max(160).default(''),
      items: z.array(ec32DerogationSchema).default([]),
      transitionNote: z.string().max(1600).default(''),
    })
    .prefault({}),
  officialInfo: z
    .object({
      obligation: z
        .object({
          title: z.string().max(240).default(''),
          intro: z.string().max(1000).default(''),
          workersTitle: z.string().max(200).default(''),
          workers: z.array(z.string().max(500)).default([]),
          employersTitle: z.string().max(200).default(''),
          employers: z.array(z.string().max(500)).default([]),
        })
        .prefault({}),
      why: z
        .object({
          title: z.string().max(240).default(''),
          subtitle: z.string().max(800).default(''),
          items: z.array(z.string().max(400)).default([]),
          note: z.string().max(800).default(''),
        })
        .prefault({}),
      help: z
        .object({
          title: z.string().max(240).default(''),
          body: z.array(z.string().max(800)).default([]),
          disclaimer: z.string().max(800).default(''),
        })
        .prefault({}),
    })
    .prefault({}),
  legal: z
    .object({
      simulationLabel: z.string().max(200).default(''),
      noRealData: z.string().max(240).default(''),
      noTransmission: z.string().max(240).default(''),
      notReplacement: z.string().max(400).default(''),
      useOfficial: z.string().max(400).default(''),
    })
    .prefault({}),
  builderMetadata: z
    .object({
      version: z.string().max(40).default('1.0'),
      lastReviewedNote: z.string().max(500).default(''),
    })
    .prefault({}),
})

// ─────────────────────────── Types dérivés ───────────────────────────

export type Ec32Content = z.infer<typeof ec32BlockSchema>
export type Ec32SimulatorContent = z.infer<typeof ec32SimulatorSchema>
export type Ec32SituationContent = z.infer<typeof ec32SituationSchema>
export type Ec32ScenarioContent = z.infer<typeof ec32ScenarioSchema>
export type Ec32FaqItem = z.infer<typeof ec32FaqSchema>
export type Ec32MistakeItem = z.infer<typeof ec32MistakeSchema>
export type Ec32LearningMode = z.infer<typeof ec32LearningModeSchema>
export type Ec32EmployerContent = z.infer<typeof ec32EmployerSchema>
export type Ec32MonthContent = z.infer<typeof ec32MonthSchema>
export type Ec32ResourceItem = z.infer<typeof ec32ResourceSchema>
export type Ec32DerogationItem = z.infer<typeof ec32DerogationSchema>
export type Ec32KeyText = z.infer<typeof ec32KeyTextSchema>
