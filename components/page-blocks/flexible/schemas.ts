import { z } from 'zod'

// --- bentoGrid ---
const bentoCellSchema = z.object({
  span: z.object({
    col: z.number().optional(),
    row: z.number().optional(),
  }),
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  href: z.string().optional(),
  bgColor: z.string().optional(),
  variant: z.enum(['default', 'highlighted', 'minimal']).optional(),
})

export const bentoGridSchema = z.object({
  title: z.string().optional(),
  cells: z.array(bentoCellSchema),
  cols: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(6)]).optional(),
})

// --- splitSection ---
export const splitSectionSchema = z.object({
  ratio: z.enum(['50-50', '60-40', '40-60', '70-30', '30-70']),
  reverseOnMobile: z.boolean().optional(),
})

// --- stickyDuo ---
export const stickyDuoSchema = z.object({
  stickySide: z.enum(['left', 'right']),
  topOffset: z.number().min(0).max(500).optional(),
})

// --- flexContainer ---
export const flexContainerSchema = z.object({
  direction: z.enum(['row', 'col']),
  gap: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  justify: z.enum(['start', 'center', 'end', 'space-between', 'space-around']).optional(),
  wrap: z.boolean().optional(),
})

// --- magazineColumns ---
export const magazineColumnsSchema = z.object({
  html: z.string().max(50000).default(''),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  gap: z.enum(['sm', 'md', 'lg']).optional(),
})

// --- radarChart ---
const radarChartDataSchema = z.object({
  label: z.string(),
  value: z.number(),
  max: z.number().optional(),
})

export const radarChartSchema = z.object({
  title: z.string().max(500).optional(),
  data: z.array(radarChartDataSchema).max(20),
  color: z.string().optional(),
  height: z.number().min(50).max(2000).optional(),
})

// --- funnelChart ---
const funnelChartStageSchema = z.object({
  label: z.string(),
  value: z.number(),
})

export const funnelChartSchema = z.object({
  title: z.string().max(500).optional(),
  stages: z.array(funnelChartStageSchema).max(20),
  color: z.string().optional(),
})

// --- gauge ---
export const gaugeSchema = z.object({
  label: z.string().max(200).optional(),
  value: z.number().min(0).max(100).default(0),
  color: z.string().optional(),
  showValue: z.boolean().optional(),
})

// --- stackedBar ---
const stackedBarDataSchema = z.object({
  label: z.string(),
  values: z.record(z.string(), z.number()),
})

export const stackedBarSchema = z.object({
  title: z.string().max(500).optional(),
  data: z.array(stackedBarDataSchema).max(50),
  series: z.array(z.string()).max(20),
  height: z.number().min(50).max(2000).optional(),
})

// --- multiLine ---
const multiLineDataSchema = z.object({
  label: z.string(),
  values: z.record(z.string(), z.number()),
})

export const multiLineSchema = z.object({
  title: z.string().max(500).optional(),
  data: z.array(multiLineDataSchema).max(50),
  series: z.array(z.string()).max(20),
  height: z.number().min(50).max(2000).optional(),
})

// --- spoiler ---
export const spoilerSchema = z.object({
  summary: z.string().max(500).default(''),
  content: z.string().max(5000).default(''),
  variant: z.enum(['default', 'subtle']).optional(),
})

// --- aside ---
export const asideSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(2000).default(''),
  variant: z.enum(['info', 'tip', 'warning', 'note']).optional(),
})

// --- editorNote ---
export const editorNoteSchema = z.object({
  content: z.string().max(2000).default(''),
  signedBy: z.string().max(200).optional(),
})

// --- dialogBlock ---
const dialogTurnSchema = z.object({
  speaker: z.string().max(120),
  message: z.string().max(2000),
  side: z.enum(['left', 'right']),
})

export const dialogBlockSchema = z.object({
  title: z.string().max(500).optional(),
  turns: z.array(dialogTurnSchema).max(50),
})

// --- diffViewer ---
export const diffViewerSchema = z.object({
  before: z.string().max(20000).default(''),
  after: z.string().max(20000).default(''),
  language: z.string().max(40).optional(),
  filename: z.string().max(120).optional(),
})

// --- mathLatex ---
export const mathLatexSchema = z.object({
  formula: z.string().max(2000).default(''),
  display: z.enum(['block', 'inline']).optional(),
})

// --- feedbackBar ---
export const feedbackBarSchema = z.object({
  question: z.string().max(500).default(''),
  thanksMessage: z.string().max(500).optional(),
  endpoint: z.string().max(500).optional(),
})

// --- suggestionBox ---
export const suggestionBoxSchema = z.object({
  title: z.string().max(500).optional(),
  placeholder: z.string().max(200).optional(),
  endpoint: z.string().max(500).optional(),
})

// --- multiStepForm ---
const multiStepFormFieldSchema = z.object({
  type: z.enum(['text', 'email', 'tel', 'textarea', 'select']),
  name: z.string(),
  label: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
})

const multiStepFormStepSchema = z.object({
  title: z.string(),
  fields: z.array(multiStepFormFieldSchema),
})

export const multiStepFormSchema = z.object({
  title: z.string().max(500).optional(),
  steps: z.array(multiStepFormStepSchema),
  submitText: z.string().max(120).default(''),
  successMessage: z.string().max(500).optional(),
  endpoint: z.string().max(500).optional(),
})

// --- donation ---
export const donationSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  presets: z.array(z.number()),
  buttonText: z.string().max(120).default('Faire un don'),
  link: z.string().max(4096).optional(),
})

// --- salaireNetBE ---
export const salaireNetBESchema = z.object({
  title: z.string().max(500).optional(),
  defaultBrut: z.number().default(3000),
  status: z.enum(['isolé', 'cohabitant', 'famille']).optional(),
})

// --- preavisCCT109 ---
export const preavisCCT109Schema = z.object({
  title: z.string().max(500).optional(),
  defaultMonths: z.number().default(24),
})

// --- allocationsFamiliales ---
export const allocationsFamilialesSchema = z.object({
  title: z.string().max(500).optional(),
  region: z.enum(['wallonie', 'bruxelles', 'flandre']).default('wallonie'),
})

// --- postalToCommune ---
export const postalToCommuneSchema = z.object({
  title: z.string().max(500).optional(),
  defaultCode: z.string().default('1000'),
})

// --- bceValidator ---
export const bceValidatorSchema = z.object({
  title: z.string().max(500).optional(),
})

// --- gradientMesh ---
export const gradientMeshSchema = z.object({
  colors: z.array(z.string()).default([]),
  height: z.number().min(50).max(2000).optional(),
  animated: z.boolean().optional(),
})

// --- sectionDivider ---
export const sectionDividerSchema = z.object({
  variant: z.enum(['wave', 'curve', 'angle', 'mountains', 'zigzag']),
  color: z.string().optional(),
  flip: z.boolean().optional(),
  height: z.number().min(20).max(400).optional(),
})

// --- glassCard ---
export const glassCardSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  blur: z.number().min(0).max(50).optional(),
  bgImage: z.string().max(4096).optional(),
})

// --- typewriter ---
export const typewriterSchema = z.object({
  texts: z.array(z.string()).default([]),
  speed: z.number().min(20).max(500).optional(),
  loop: z.boolean().optional(),
  cursor: z.boolean().optional(),
})

// --- kenBurns ---
export const kenBurnsSchema = z.object({
  image: z.string().max(4096).default(''),
  caption: z.string().max(500).optional(),
  duration: z.number().min(5).max(120).optional(),
})

// --- particles ---
export const particlesSchema = z.object({
  count: z.number().min(5).max(200).optional(),
  color: z.string().optional(),
  speed: z.enum(['slow', 'normal', 'fast']).optional(),
})

// --- newsTicker ---
const newsTickerItemSchema = z.object({
  label: z.string(),
  href: z.string().optional(),
  date: z.string().optional(),
})

export const newsTickerSchema = z.object({
  items: z.array(newsTickerItemSchema).max(50),
  speed: z.enum(['slow', 'normal', 'fast']).optional(),
})

// --- flashcards ---
const flashcardsCardSchema = z.object({
  front: z.string().max(500),
  back: z.string().max(2000),
})

export const flashcardsSchema = z.object({
  title: z.string().max(500).optional(),
  items: z.array(flashcardsCardSchema).max(100),
})

// --- ttsButton ---
export const ttsButtonSchema = z.object({
  text: z.string().max(20000).optional(),
  label: z.string().max(120).optional(),
  voice: z.string().max(20).optional(),
})

// --- a11yToolbar ---
export const a11yToolbarSchema = z.object({
  position: z.enum(['top-right', 'bottom-right']).optional(),
  enableFontSizer: z.boolean().optional(),
  enableHighContrast: z.boolean().optional(),
  enableDyslexiaFont: z.boolean().optional(),
})

export const flexibleSchemas = {
  bentoGrid: bentoGridSchema,
  splitSection: splitSectionSchema,
  stickyDuo: stickyDuoSchema,
  flexContainer: flexContainerSchema,
  magazineColumns: magazineColumnsSchema,
  radarChart: radarChartSchema,
  funnelChart: funnelChartSchema,
  gauge: gaugeSchema,
  stackedBar: stackedBarSchema,
  multiLine: multiLineSchema,
  spoiler: spoilerSchema,
  aside: asideSchema,
  editorNote: editorNoteSchema,
  dialogBlock: dialogBlockSchema,
  diffViewer: diffViewerSchema,
  mathLatex: mathLatexSchema,
  feedbackBar: feedbackBarSchema,
  suggestionBox: suggestionBoxSchema,
  multiStepForm: multiStepFormSchema,
  donation: donationSchema,
  salaireNetBE: salaireNetBESchema,
  preavisCCT109: preavisCCT109Schema,
  allocationsFamiliales: allocationsFamilialesSchema,
  postalToCommune: postalToCommuneSchema,
  bceValidator: bceValidatorSchema,
  gradientMesh: gradientMeshSchema,
  sectionDivider: sectionDividerSchema,
  glassCard: glassCardSchema,
  typewriter: typewriterSchema,
  kenBurns: kenBurnsSchema,
  particles: particlesSchema,
  newsTicker: newsTickerSchema,
  flashcards: flashcardsSchema,
  ttsButton: ttsButtonSchema,
  a11yToolbar: a11yToolbarSchema,
} as const
