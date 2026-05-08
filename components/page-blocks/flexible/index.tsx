// Aggregator for the 35 flexible blocks (charts, layouts, text-rich, engagement,
// docbel calculators, decorative, education, utility-extra).

import { bentoGrid } from './bento-grid'
import { splitSection } from './split-section'
import { stickyDuo } from './sticky-duo'
import { flexContainer } from './flex-container'
import { magazineColumns } from './magazine-columns'

import { radarChart } from './radar-chart'
import { funnelChart } from './funnel-chart'
import { gauge } from './gauge'
import { stackedBar } from './stacked-bar'
import { multiLine } from './multi-line'

import { spoiler } from './spoiler'
import { aside } from './aside'
import { editorNote } from './editor-note'
import { dialogBlock } from './dialog-block'
import { diffViewer } from './diff-viewer'
import { mathLatex } from './math-latex'

import { feedbackBar } from './feedback-bar'
import { suggestionBox } from './suggestion-box'
import { multiStepForm } from './multi-step-form'
import { donation } from './donation'

import { salaireNetBE } from './salaire-net-be'
import { preavisCCT109 } from './preavis-cct109'
import { allocationsFamiliales } from './allocations-familiales'
import { postalToCommune } from './postal-to-commune'
import { bceValidator } from './bce-validator'

import { gradientMesh } from './gradient-mesh'
import { sectionDivider } from './section-divider'
import { glassCard } from './glass-card'
import { typewriter } from './typewriter'
import { kenBurns } from './ken-burns'
import { particles } from './particles'

import { newsTicker } from './news-ticker'

import { flashcards } from './flashcards'
import { ttsButton } from './tts-button'
import { a11yToolbar } from './a11y-toolbar'

export const flexibleBlocks = {
  bentoGrid,
  splitSection,
  stickyDuo,
  flexContainer,
  magazineColumns,
  radarChart,
  funnelChart,
  gauge,
  stackedBar,
  multiLine,
  spoiler,
  aside,
  editorNote,
  dialogBlock,
  diffViewer,
  mathLatex,
  feedbackBar,
  suggestionBox,
  multiStepForm,
  donation,
  salaireNetBE,
  preavisCCT109,
  allocationsFamiliales,
  postalToCommune,
  bceValidator,
  gradientMesh,
  sectionDivider,
  glassCard,
  typewriter,
  kenBurns,
  particles,
  newsTicker,
  flashcards,
  ttsButton,
  a11yToolbar,
} as const
