// =====================================================================
//  Page Builder — Type System
// =====================================================================
//  Each block carries 4 layers of properties:
//   • props      → block-specific content (title, link, image, items…)
//   • style      → visual design (typography, color, background, border, shadow)
//   • layout     → boxing (padding, margin, alignment, sizing, visibility)
//   • advanced   → id, classes, anchor, animation
//   • responsive → optional overrides for tablet/mobile
// =====================================================================

export type BlockType =
  // text & content
  | 'heading'
  | 'text'
  | 'quote'
  | 'divider'
  | 'spacer'
  | 'codeBlock'
  | 'pullQuote'
  | 'dropCap'
  | 'definitionList'
  | 'highlight'
  | 'prosCons'
  | 'checklist'
  // media
  | 'image'
  | 'video'
  | 'gallery'
  | 'embed'
  | 'audio'
  | 'carousel'
  | 'beforeAfter'
  | 'logoWall'
  | 'svgIllustration'
  // layout
  | 'section'
  | 'container'
  | 'columns'
  // marketing
  | 'hero'
  | 'features'
  | 'cta'
  | 'faq'
  | 'testimonial'
  | 'stats'
  | 'pricingTable'
  | 'compareTable'
  | 'countdown'
  | 'notificationBar'
  | 'newsletter'
  | 'trustBadges'
  | 'pressMentions'
  | 'starRating'
  // ui (shadcn-style)
  | 'card'
  | 'accordion'
  | 'tabs'
  | 'alert'
  | 'badges'
  | 'progress'
  | 'buttonGroup'
  // charts
  | 'barChart'
  | 'lineChart'
  | 'pieChart'
  | 'kpiCard'
  | 'sparkline'
  | 'heatmap'
  | 'chronology'
  // engagement
  | 'quiz'
  | 'poll'
  | 'calculator'
  | 'reactions'
  | 'shareButtons'
  // time/nav
  | 'openingHours'
  | 'lastUpdated'
  | 'tableOfContents'
  | 'anchorMenu'
  | 'backToTop'
  | 'readingProgress'
  // editorial
  | 'articleHeader'
  | 'authorBio'
  | 'sponsoredDisclosure'
  // docbel
  | 'document'
  | 'steps'
  | 'organisme'
  | 'glossary'
  | 'counter'
  | 'collection'
  | 'form'
  | 'belgianDateHelper'
  | 'tarifsTable'
  | 'eligibilityTest'
  | 'lawCitation'
  | 'casePractice'
  | 'requiredDocs'
  | 'legalDelay'
  // story / decorative
  | 'marquee'
  | 'tiltCard'
  | 'imageHotspots'
  // utility (admin only)
  | 'htmlRaw'
  | 'customCss'
  | 'gdprNotice'
  | 'mapEmbed'
  // Layout-flex
  | 'bentoGrid'
  | 'splitSection'
  | 'stickyDuo'
  | 'flexContainer'
  | 'magazineColumns'
  // Charts-extra
  | 'radarChart'
  | 'funnelChart'
  | 'gauge'
  | 'stackedBar'
  | 'multiLine'
  // Text-rich
  | 'spoiler'
  | 'aside'
  | 'editorNote'
  | 'dialogBlock'
  | 'diffViewer'
  | 'mathLatex'
  // Engagement-extra
  | 'feedbackBar'
  | 'suggestionBox'
  | 'multiStepForm'
  | 'donation'
  // DocBel calculators
  | 'salaireNetBE'
  | 'preavisCCT109'
  | 'allocationsFamiliales'
  | 'postalToCommune'
  | 'bceValidator'
  // Decorative
  | 'gradientMesh'
  | 'sectionDivider'
  | 'glassCard'
  | 'typewriter'
  | 'kenBurns'
  | 'particles'
  | 'newsTicker'
  // Education / a11y
  | 'flashcards'
  | 'ttsButton'
  | 'a11yToolbar'

export type BlockCategory = 'text' | 'media' | 'layout' | 'marketing' | 'ui' | 'charts' | 'engagement' | 'navigation' | 'editorial' | 'docbel' | 'utility' | 'decorative' | 'education'

export type DeviceType = 'desktop' | 'tablet' | 'mobile'

// ────────────────────────── Block-specific props ──────────────────────────

export interface HeadingProps {
  text: string
  level: 1 | 2 | 3 | 4 | 5 | 6
  variant?: 'default' | 'display' | 'gradient'
}

export interface TextProps {
  html: string
  variant?: 'default' | 'lead' | 'small'
}

export interface QuoteProps {
  text: string
  author?: string
  role?: string
  variant?: 'simple' | 'pull' | 'card'
}

export interface DividerProps {
  variant?: 'solid' | 'dashed' | 'dotted' | 'gradient'
  thickness?: number
}

export interface SpacerProps {
  height: number // px
}

export interface ImageProps {
  url: string
  alt: string
  caption?: string
  ratio?: 'auto' | '1:1' | '4:3' | '16:9' | '21:9'
  fit?: 'cover' | 'contain'
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full'
}

export type VideoProvider =
  | 'youtube'
  | 'vimeo'
  | 'tiktok'
  | 'dailymotion'
  | 'loom'
  | 'mp4'

export interface VideoProps {
  url: string
  provider: VideoProvider
  caption?: string
  autoplay?: boolean
  controls?: boolean
  /** When set, render the upload-managed file from /api/files/{fileId}/download (provider must be 'mp4'). */
  fileId?: string
}

export interface GalleryItem {
  url: string
  alt: string
  caption?: string
}

export interface GalleryProps {
  items: GalleryItem[]
  columns: 2 | 3 | 4
  variant?: 'grid' | 'masonry'
  gap?: 'sm' | 'md' | 'lg'
}

export interface EmbedProps {
  html: string
  height?: number
}

export interface SectionProps {
  bgType?: 'none' | 'color' | 'gradient' | 'image'
  bgColor?: string
  bgGradient?: string
  bgImage?: string
  bgOverlay?: string
  fullWidth?: boolean
}

export interface ContainerProps {
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export interface ColumnsProps {
  count: 2 | 3 | 4
  gap?: 'sm' | 'md' | 'lg'
  // children block ids — children are still flat in the blocks array,
  // they reference parent via block.parentId
}

export interface HeroProps {
  title: string
  subtitle?: string
  description?: string
  ctaText?: string
  ctaLink?: string
  ctaSecondaryText?: string
  ctaSecondaryLink?: string
  image?: string
  bgColor?: string
  variant?: 'centered' | 'split' | 'minimal' | 'fullbleed'
}

export interface FeatureItem {
  icon?: string
  title: string
  description: string
}

export interface FeaturesProps {
  title?: string
  subtitle?: string
  items: FeatureItem[]
  columns: 2 | 3 | 4
  variant?: 'cards' | 'icons' | 'centered'
}

export interface CtaProps {
  title?: string
  description?: string
  text: string
  link: string
  secondaryText?: string
  secondaryLink?: string
  variant?: 'inline' | 'banner' | 'card'
  buttonStyle?: 'primary' | 'secondary' | 'outline' | 'ghost'
  buttonSize?: 'sm' | 'md' | 'lg'
}

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqProps {
  title?: string
  items: FaqItem[]
  variant?: 'simple' | 'bordered' | 'card'
}

export interface TestimonialItem {
  quote: string
  author: string
  role?: string
  avatar?: string
}

export interface TestimonialProps {
  title?: string
  items: TestimonialItem[]
  variant?: 'single' | 'grid' | 'carousel'
}

export interface StatItem {
  value: string
  label: string
  prefix?: string
  suffix?: string
}

export interface StatsProps {
  title?: string
  items: StatItem[]
  columns: 2 | 3 | 4
  variant?: 'simple' | 'cards' | 'centered'
}

// ──────────────────── shadcn-style UI blocks ────────────────────

export interface CardProps {
  title?: string
  description?: string
  body?: string
  image?: string
  ctaText?: string
  ctaLink?: string
  variant?: 'default' | 'bordered' | 'elevated' | 'gradient'
}

export interface AccordionItemData {
  title: string
  content: string
}
export interface AccordionProps {
  items: AccordionItemData[]
  type?: 'single' | 'multiple'
  variant?: 'default' | 'bordered' | 'separated'
}

export interface TabItem {
  label: string
  content: string
}
export interface TabsProps {
  items: TabItem[]
  variant?: 'default' | 'pills' | 'underline'
}

export interface AlertProps {
  title?: string
  message: string
  variant?: 'info' | 'success' | 'warning' | 'destructive'
  dismissible?: boolean
  icon?: string // lucide icon name
}

export interface BadgeItem {
  label: string
  variant?: 'default' | 'secondary' | 'outline' | 'destructive'
  color?: string
}
export interface BadgesProps {
  title?: string
  items: BadgeItem[]
  align?: 'left' | 'center'
}

export interface ProgressProps {
  label?: string
  value: number // 0-100
  showValue?: boolean
  color?: string
  variant?: 'default' | 'segmented' | 'circular'
}

export interface ButtonGroupItem {
  text: string
  link: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  icon?: string
}
export interface ButtonGroupProps {
  items: ButtonGroupItem[]
  align?: 'left' | 'center' | 'right'
  size?: 'sm' | 'md' | 'lg'
}

// ──────────────────── DocBel-specific blocks ────────────────────

export interface DocumentProps {
  fileId?: string // reference to /api/files/{id}
  url?: string // fallback for external URL
  title: string
  description?: string
  fileType?: 'pdf' | 'docx' | 'xlsx' | 'image' | 'archive' | 'other'
  size?: string // human-readable, e.g. "1.2 MB"
  date?: string // human-readable, e.g. "Mis à jour 15 mars 2026"
  variant?: 'card' | 'inline' | 'list'
}

export interface StepItem {
  title: string
  description: string
  icon?: string
  status?: 'todo' | 'current' | 'done'
}
export interface StepsProps {
  title?: string
  subtitle?: string
  items: StepItem[]
  orientation?: 'horizontal' | 'vertical'
  variant?: 'numbered' | 'icons' | 'compact'
}

export interface OrganismeProps {
  name: string
  description?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  hours?: string
  logo?: string
  variant?: 'card' | 'compact' | 'detailed'
}

export interface GlossaryTerm {
  term: string
  definition: string
}
export interface GlossaryProps {
  title?: string
  items: GlossaryTerm[]
  variant?: 'list' | 'cards' | 'alphabetical'
}

export interface CounterItem {
  value: number
  label: string
  prefix?: string
  suffix?: string
}
export interface CounterProps {
  title?: string
  items: CounterItem[]
  columns: 2 | 3 | 4
  duration?: number // animation duration in ms
}

export interface CollectionProps {
  source: 'news' | 'pages'
  limit: number
  category?: string
  layout: 'grid' | 'list' | 'carousel'
  columns?: 2 | 3 | 4
}

export interface FormFieldDef {
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox'
  name: string
  label: string
  placeholder?: string
  required?: boolean
  options?: string[] // for select
}
export interface FormProps {
  title?: string
  description?: string
  fields: FormFieldDef[]
  submitText: string
  successMessage?: string
  endpoint?: string // POST endpoint, defaults to /api/messages
}

// ════════════════════════════════════════════════════════════════════
//  Text-extra
// ════════════════════════════════════════════════════════════════════

export interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
}
export interface PullQuoteProps {
  text: string
  author?: string
  align?: 'left' | 'center' | 'right'
}
export interface DropCapProps {
  html: string
  capColor?: string
}
export interface DefinitionItem {
  term: string
  definition: string
}
export interface DefinitionListProps {
  items: DefinitionItem[]
}
export interface HighlightProps {
  text: string
  color?: 'yellow' | 'green' | 'pink' | 'blue' | 'orange'
}
export interface ProsConsProps {
  pros: string[]
  cons: string[]
  prosTitle?: string
  consTitle?: string
}
export interface ChecklistItemDef {
  text: string
  checked?: boolean
}
export interface ChecklistProps {
  title?: string
  items: ChecklistItemDef[]
  interactive?: boolean
}

// ════════════════════════════════════════════════════════════════════
//  Media-extra
// ════════════════════════════════════════════════════════════════════

export interface AudioProps {
  url: string
  fileId?: string
  title?: string
  artist?: string
  caption?: string
}
export interface CarouselSlide {
  image: string
  alt?: string
  caption?: string
  link?: string
}
export interface CarouselProps {
  slides: CarouselSlide[]
  autoplay?: boolean
  interval?: number
  showDots?: boolean
  showArrows?: boolean
}
export interface BeforeAfterProps {
  beforeUrl: string
  afterUrl: string
  beforeLabel?: string
  afterLabel?: string
  orientation?: 'horizontal' | 'vertical'
}
export interface LogoWallProps {
  title?: string
  logos: { url: string; alt: string; href?: string }[]
  variant?: 'grid' | 'marquee'
  grayscale?: boolean
}
export interface SvgIllustrationProps {
  svg: string
  width?: string
  height?: string
}

// ════════════════════════════════════════════════════════════════════
//  Marketing-extra
// ════════════════════════════════════════════════════════════════════

export interface PricingPlan {
  name: string
  price: string
  period?: string
  description?: string
  features: string[]
  ctaText: string
  ctaLink: string
  highlighted?: boolean
  badge?: string
}
export interface PricingTableProps {
  title?: string
  subtitle?: string
  plans: PricingPlan[]
  togglePeriod?: boolean
}
export interface CompareRow {
  feature: string
  values: (boolean | string)[]
}
export interface CompareTableProps {
  title?: string
  columns: string[]
  rows: CompareRow[]
  highlightColumn?: number
}
export interface CountdownProps {
  targetDate: string // ISO
  title?: string
  variant?: 'large' | 'compact'
  expiredMessage?: string
}
export interface NotificationBarProps {
  message: string
  ctaText?: string
  ctaLink?: string
  variant?: 'info' | 'success' | 'warning' | 'destructive'
  dismissible?: boolean
}
export interface NewsletterProps {
  title?: string
  description?: string
  placeholder?: string
  buttonText: string
  endpoint?: string
  successMessage?: string
}
export interface TrustBadgesProps {
  badges: { icon?: string; label: string }[]
  align?: 'left' | 'center'
}
export interface PressMentionsProps {
  title?: string
  logos: { url: string; alt: string; href?: string }[]
}
export interface StarRatingProps {
  value: number // 0-5
  count?: number
  showCount?: boolean
  size?: 'sm' | 'md' | 'lg'
}

// ════════════════════════════════════════════════════════════════════
//  Charts (recharts)
// ════════════════════════════════════════════════════════════════════

export interface ChartDataPoint {
  label: string
  value: number
}
export interface BarChartProps {
  title?: string
  data: ChartDataPoint[]
  color?: string
  horizontal?: boolean
  height?: number
}
export interface LineChartProps {
  title?: string
  data: ChartDataPoint[]
  color?: string
  smooth?: boolean
  height?: number
}
export interface PieChartProps {
  title?: string
  data: ChartDataPoint[]
  donut?: boolean
  height?: number
}
export interface KpiCardProps {
  label: string
  value: string
  trendValue?: number // percentage change
  trendLabel?: string
  color?: string
  icon?: string
}
export interface SparklineProps {
  data: number[]
  color?: string
  label?: string
  value?: string
}
export interface HeatmapDay {
  date: string // YYYY-MM-DD
  value: number
}
export interface HeatmapProps {
  title?: string
  data: HeatmapDay[]
  color?: string
}
export interface ChronologyEvent {
  date: string
  title: string
  description?: string
  icon?: string
}
export interface ChronologyProps {
  title?: string
  events: ChronologyEvent[]
  variant?: 'vertical' | 'horizontal'
}

// ════════════════════════════════════════════════════════════════════
//  Engagement
// ════════════════════════════════════════════════════════════════════

export interface QuizQuestion {
  question: string
  options: string[]
  correct: number
  explanation?: string
}
export interface QuizProps {
  title?: string
  questions: QuizQuestion[]
  resultMessages?: { min: number; message: string }[]
}
export interface PollOption {
  label: string
  votes: number
}
export interface PollProps {
  question: string
  options: PollOption[]
}
export interface CalculatorField {
  name: string
  label: string
  type: 'number' | 'select'
  defaultValue?: number | string
  options?: { label: string; value: string | number }[]
  unit?: string
}
export interface CalculatorProps {
  title?: string
  description?: string
  fields: CalculatorField[]
  formula: string // JS expression: "salaire * 0.7"
  resultLabel: string
  resultUnit?: string
  resultPrecision?: number
}
export interface ReactionsProps {
  reactions: { emoji: string; label: string; count: number }[]
}
export interface ShareButtonsProps {
  platforms: ('twitter' | 'linkedin' | 'facebook' | 'email' | 'whatsapp' | 'copy')[]
  align?: 'left' | 'center' | 'right'
  size?: 'sm' | 'md' | 'lg'
  utmCampaign?: string
}

// ════════════════════════════════════════════════════════════════════
//  Time / Nav
// ════════════════════════════════════════════════════════════════════

export interface OpeningHoursDay {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
  open?: string // "09:00"
  close?: string // "17:00"
  closed?: boolean
}
export interface OpeningHoursProps {
  title?: string
  schedule: OpeningHoursDay[]
  showCurrentStatus?: boolean
}
export interface LastUpdatedProps {
  date?: string // ISO; if omitted uses page updatedAt
  format?: 'long' | 'short' | 'relative'
  prefix?: string
}
export interface TableOfContentsProps {
  title?: string
  sticky?: boolean
  maxLevel?: 2 | 3 | 4
}
export interface AnchorMenuProps {
  items: { label: string; anchor: string }[]
  sticky?: boolean
}
export interface BackToTopProps {
  threshold?: number
}
export interface ReadingProgressProps {
  color?: string
  height?: number
}

// ════════════════════════════════════════════════════════════════════
//  Editorial
// ════════════════════════════════════════════════════════════════════

export interface ArticleHeaderProps {
  category?: string
  title: string
  excerpt?: string
  authorName?: string
  authorAvatar?: string
  date?: string
  readingTime?: number
  image?: string
}
export interface AuthorBioProps {
  name: string
  bio?: string
  avatar?: string
  twitter?: string
  linkedin?: string
  website?: string
  email?: string
}
export interface SponsoredDisclosureProps {
  sponsor?: string
}

// ════════════════════════════════════════════════════════════════════
//  DocBel-extra (Belgian admin-specific)
// ════════════════════════════════════════════════════════════════════

export interface BelgianDateHelperProps {
  startDate: string // ISO
  daysToAdd: number
  countWeekendsAndHolidays: 'all' | 'businessOnly'
  label?: string
}
export interface TarifsRow {
  situation: string
  montant: string
  periode?: string
  remarque?: string
}
export interface TarifsTableProps {
  title?: string
  subtitle?: string
  rows: TarifsRow[]
  source?: string
}
export interface EligibilityCriterion {
  question: string
  pass: boolean
}
export interface EligibilityTestProps {
  title?: string
  introText?: string
  questions: { question: string; type: 'yesno' | 'select'; options?: string[] }[]
  rules: { allYes?: boolean; minYes?: number; resultIfPass: string; resultIfFail: string }
}
export interface LawCitationProps {
  reference: string // e.g. "Art. 23 — LOI du 26 mai 2002"
  text: string
  source?: string
  link?: string
}
export interface CasePracticeProps {
  title: string
  situation: string
  steps: string[]
  outcome?: string
}
export interface RequiredDoc {
  name: string
  required: boolean
  description?: string
}
export interface RequiredDocsProps {
  title?: string
  items: RequiredDoc[]
}
export interface LegalDelayProps {
  delay: string // "30 jours"
  context: string // "pour répondre à une décision"
  variant?: 'large' | 'inline'
}

// ════════════════════════════════════════════════════════════════════
//  Story / Decorative
// ════════════════════════════════════════════════════════════════════

export interface MarqueeProps {
  text: string
  speed?: 'slow' | 'normal' | 'fast'
  reverse?: boolean
  color?: string
}
export interface TiltCardProps {
  title: string
  description?: string
  image?: string
  link?: string
}
export interface HotspotPoint {
  x: number // percentage 0-100
  y: number
  title: string
  description: string
}
export interface ImageHotspotsProps {
  image: string
  alt?: string
  hotspots: HotspotPoint[]
}

// ════════════════════════════════════════════════════════════════════
//  Utility / Trust
// ════════════════════════════════════════════════════════════════════

export interface HtmlRawProps {
  html: string
}
export interface CustomCssProps {
  css: string
}
export interface GdprNoticeProps {
  message: string
  acceptText: string
  declineText?: string
  link?: string
  linkText?: string
}
export interface MapEmbedProps {
  query: string // OSM search query, e.g. "Rue de la Loi 16, Bruxelles"
  zoom?: number
  height?: number
  caption?: string
}

// ════════════════════════════════════════════════════════════════════
//  Layout-flex
// ════════════════════════════════════════════════════════════════════

export interface BentoCellDef {
  span: { col?: number; row?: number }
  bgColor?: string
  title?: string
  description?: string
  image?: string
  href?: string
  variant?: 'default' | 'highlighted' | 'minimal'
}
export interface BentoGridProps {
  title?: string
  cells: BentoCellDef[]
  cols?: 2 | 3 | 4 | 6
}

export interface SplitSectionProps {
  ratio: '50-50' | '60-40' | '40-60' | '70-30' | '30-70'
  reverseOnMobile?: boolean
  // children rendered via slot 0/1
}

export interface StickyDuoProps {
  stickySide: 'left' | 'right'
  /** offset from top in px when sticky (default 80) */
  topOffset?: number
}

export interface FlexContainerProps {
  direction: 'row' | 'column' | 'row-reverse' | 'column-reverse'
  gap?: 'sm' | 'md' | 'lg' | 'xl'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around'
  wrap?: boolean
}

export interface MagazineColumnsProps {
  html: string
  columns: 2 | 3 | 4
  gap?: 'sm' | 'md' | 'lg'
}

// ════════════════════════════════════════════════════════════════════
//  Charts-extra
// ════════════════════════════════════════════════════════════════════

export interface RadarChartProps {
  title?: string
  data: { label: string; value: number; max?: number }[]
  color?: string
  height?: number
}
export interface FunnelStage {
  label: string
  value: number
}
export interface FunnelChartProps {
  title?: string
  stages: FunnelStage[]
  color?: string
}
export interface GaugeProps {
  label?: string
  value: number // 0-100
  color?: string
  showValue?: boolean
}
export interface StackedSeriesPoint {
  label: string
  values: Record<string, number>
}
export interface StackedBarProps {
  title?: string
  data: StackedSeriesPoint[]
  series: string[] // keys from values
  height?: number
}
export interface MultiLineProps {
  title?: string
  data: { label: string; values: Record<string, number> }[]
  series: string[]
  height?: number
}

// ════════════════════════════════════════════════════════════════════
//  Text-rich
// ════════════════════════════════════════════════════════════════════

export interface SpoilerProps {
  summary: string
  content: string
  variant?: 'default' | 'subtle'
}
export interface AsideProps {
  title?: string
  content: string
  variant?: 'info' | 'tip' | 'warning' | 'note'
}
export interface EditorNoteProps {
  content: string
  signedBy?: string
}
export interface DialogTurn {
  speaker: string
  message: string
  side?: 'left' | 'right'
}
export interface DialogBlockProps {
  title?: string
  turns: DialogTurn[]
}
export interface DiffViewerProps {
  before: string
  after: string
  language?: string
  filename?: string
}
export interface MathLatexProps {
  formula: string
  display?: 'inline' | 'block'
}

// ════════════════════════════════════════════════════════════════════
//  Engagement-extra
// ════════════════════════════════════════════════════════════════════

export interface FeedbackBarProps {
  question: string
  thanksMessage?: string
  endpoint?: string
}
export interface SuggestionBoxProps {
  title?: string
  placeholder?: string
  endpoint?: string
}
export interface MultiStepFormStep {
  title: string
  fields: FormFieldDef[]
}
export interface MultiStepFormProps {
  title?: string
  steps: MultiStepFormStep[]
  submitText: string
  successMessage?: string
  endpoint?: string
}
export interface DonationProps {
  title?: string
  description?: string
  presets: number[]
  buttonText: string
  link?: string // mailto/payment link
}

// ════════════════════════════════════════════════════════════════════
//  DocBel calculators
// ════════════════════════════════════════════════════════════════════

export interface SalaireNetBEProps {
  title?: string
  defaultBrut?: number
  status?: 'isolé' | 'cohabitant' | 'famille'
}
export interface PreavisCCT109Props {
  title?: string
  defaultMonths?: number
}
export interface AllocationsFamilialesProps {
  title?: string
  region?: 'wallonie' | 'bruxelles' | 'flandre'
}
export interface PostalToCommuneProps {
  title?: string
  defaultCode?: string
}
export interface BceValidatorProps {
  title?: string
}

// ════════════════════════════════════════════════════════════════════
//  Decorative
// ════════════════════════════════════════════════════════════════════

export interface GradientMeshProps {
  colors: string[]
  height?: number
  animated?: boolean
}
export interface SectionDividerProps {
  variant: 'wave' | 'curve' | 'angle' | 'mountains' | 'zigzag'
  color?: string
  flip?: boolean
  height?: number
}
export interface GlassCardProps {
  title?: string
  description?: string
  blur?: number
  bgImage?: string
}
export interface TypewriterProps {
  texts: string[]
  speed?: number
  loop?: boolean
  cursor?: boolean
}
export interface KenBurnsProps {
  image: string
  caption?: string
  duration?: number
}
export interface ParticlesProps {
  count?: number
  color?: string
  speed?: 'slow' | 'normal' | 'fast'
}
export interface NewsTickerProps {
  items: { label: string; href?: string; date?: string }[]
  speed?: 'slow' | 'normal' | 'fast'
}

// ════════════════════════════════════════════════════════════════════
//  Education / a11y
// ════════════════════════════════════════════════════════════════════

export interface FlashCardItem {
  front: string
  back: string
}
export interface FlashcardsProps {
  title?: string
  items: FlashCardItem[]
}
export interface TtsButtonProps {
  text?: string // optional override; defaults to selected text on the page
  label?: string
  voice?: string
}
export interface A11yToolbarProps {
  position?: 'top-right' | 'bottom-right'
  enableFontSizer?: boolean
  enableHighContrast?: boolean
  enableDyslexiaFont?: boolean
}

// ──────────────────────────── Style / Layout / Advanced ────────────────────────────

export interface BlockStyle {
  // Typography
  fontFamily?: string
  fontSize?: number // px
  fontWeight?: 300 | 400 | 500 | 600 | 700 | 800
  lineHeight?: number
  letterSpacing?: number
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  textColor?: string
  // Background
  bgColor?: string
  // Border
  borderWidth?: number
  borderColor?: string
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  borderRadius?: number
  // Shadow
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  // Effects
  opacity?: number
}

export interface BlockLayout {
  // Sizing
  width?: string // any CSS value: 'auto', '100%', '320px'
  maxWidth?: string
  height?: string
  minHeight?: string
  // Spacing (px). undefined = inherit / default
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  marginTop?: number
  marginRight?: number
  marginBottom?: number
  marginLeft?: number
  // Alignment of the block within its parent
  align?: 'left' | 'center' | 'right' | 'stretch'
  // Visibility per device
  hideOnDesktop?: boolean
  hideOnTablet?: boolean
  hideOnMobile?: boolean
}

export interface BlockAdvanced {
  htmlId?: string
  className?: string
  anchor?: string // for in-page anchor links
  animation?:
    | 'none'
    | 'fade-in'
    | 'fade-up'
    | 'fade-down'
    | 'slide-left'
    | 'slide-right'
    | 'zoom-in'
  animationDelay?: number // ms
  /** Trigger animation when entering viewport (IntersectionObserver) instead of on mount. */
  animateOnScroll?: boolean
  /** Conditional rendering. */
  showIf?: 'always' | 'loggedIn' | 'loggedOut'
}

/** Editor-only flags. Saved with the block but ignored by the public renderer's logic. */
export interface BlockMeta {
  locked?: boolean
  hidden?: boolean
}

export type ResponsiveOverride = {
  style?: Partial<BlockStyle>
  layout?: Partial<BlockLayout>
}

// ──────────────────────────── Block Map ────────────────────────────

export type BlockPropsMap = {
  heading: HeadingProps
  text: TextProps
  quote: QuoteProps
  divider: DividerProps
  spacer: SpacerProps
  image: ImageProps
  video: VideoProps
  gallery: GalleryProps
  embed: EmbedProps
  section: SectionProps
  container: ContainerProps
  columns: ColumnsProps
  hero: HeroProps
  features: FeaturesProps
  cta: CtaProps
  faq: FaqProps
  testimonial: TestimonialProps
  stats: StatsProps
  card: CardProps
  accordion: AccordionProps
  tabs: TabsProps
  alert: AlertProps
  badges: BadgesProps
  progress: ProgressProps
  buttonGroup: ButtonGroupProps
  document: DocumentProps
  steps: StepsProps
  organisme: OrganismeProps
  glossary: GlossaryProps
  counter: CounterProps
  collection: CollectionProps
  form: FormProps
  // text-extra
  codeBlock: CodeBlockProps
  pullQuote: PullQuoteProps
  dropCap: DropCapProps
  definitionList: DefinitionListProps
  highlight: HighlightProps
  prosCons: ProsConsProps
  checklist: ChecklistProps
  // media-extra
  audio: AudioProps
  carousel: CarouselProps
  beforeAfter: BeforeAfterProps
  logoWall: LogoWallProps
  svgIllustration: SvgIllustrationProps
  // marketing-extra
  pricingTable: PricingTableProps
  compareTable: CompareTableProps
  countdown: CountdownProps
  notificationBar: NotificationBarProps
  newsletter: NewsletterProps
  trustBadges: TrustBadgesProps
  pressMentions: PressMentionsProps
  starRating: StarRatingProps
  // charts
  barChart: BarChartProps
  lineChart: LineChartProps
  pieChart: PieChartProps
  kpiCard: KpiCardProps
  sparkline: SparklineProps
  heatmap: HeatmapProps
  chronology: ChronologyProps
  // engagement
  quiz: QuizProps
  poll: PollProps
  calculator: CalculatorProps
  reactions: ReactionsProps
  shareButtons: ShareButtonsProps
  // time/nav
  openingHours: OpeningHoursProps
  lastUpdated: LastUpdatedProps
  tableOfContents: TableOfContentsProps
  anchorMenu: AnchorMenuProps
  backToTop: BackToTopProps
  readingProgress: ReadingProgressProps
  // editorial
  articleHeader: ArticleHeaderProps
  authorBio: AuthorBioProps
  sponsoredDisclosure: SponsoredDisclosureProps
  // docbel-extra
  belgianDateHelper: BelgianDateHelperProps
  tarifsTable: TarifsTableProps
  eligibilityTest: EligibilityTestProps
  lawCitation: LawCitationProps
  casePractice: CasePracticeProps
  requiredDocs: RequiredDocsProps
  legalDelay: LegalDelayProps
  // story
  marquee: MarqueeProps
  tiltCard: TiltCardProps
  imageHotspots: ImageHotspotsProps
  // utility
  htmlRaw: HtmlRawProps
  customCss: CustomCssProps
  gdprNotice: GdprNoticeProps
  mapEmbed: MapEmbedProps
  // Layout-flex
  bentoGrid: BentoGridProps
  splitSection: SplitSectionProps
  stickyDuo: StickyDuoProps
  flexContainer: FlexContainerProps
  magazineColumns: MagazineColumnsProps
  // Charts-extra
  radarChart: RadarChartProps
  funnelChart: FunnelChartProps
  gauge: GaugeProps
  stackedBar: StackedBarProps
  multiLine: MultiLineProps
  // Text-rich
  spoiler: SpoilerProps
  aside: AsideProps
  editorNote: EditorNoteProps
  dialogBlock: DialogBlockProps
  diffViewer: DiffViewerProps
  mathLatex: MathLatexProps
  // Engagement-extra
  feedbackBar: FeedbackBarProps
  suggestionBox: SuggestionBoxProps
  multiStepForm: MultiStepFormProps
  donation: DonationProps
  // DocBel calculators
  salaireNetBE: SalaireNetBEProps
  preavisCCT109: PreavisCCT109Props
  allocationsFamiliales: AllocationsFamilialesProps
  postalToCommune: PostalToCommuneProps
  bceValidator: BceValidatorProps
  // Decorative
  gradientMesh: GradientMeshProps
  sectionDivider: SectionDividerProps
  glassCard: GlassCardProps
  typewriter: TypewriterProps
  kenBurns: KenBurnsProps
  particles: ParticlesProps
  newsTicker: NewsTickerProps
  // Education / a11y
  flashcards: FlashcardsProps
  ttsButton: TtsButtonProps
  a11yToolbar: A11yToolbarProps
}

export type Block<T extends BlockType = BlockType> = {
  [K in BlockType]: {
    id: string
    type: K
    props: BlockPropsMap[K]
    style?: BlockStyle
    layout?: BlockLayout
    advanced?: BlockAdvanced
    meta?: BlockMeta
    responsive?: {
      tablet?: ResponsiveOverride
      mobile?: ResponsiveOverride
    }
    parentId?: string | null // null/undefined = top-level
    /** Slot index inside the parent. Only meaningful for `columns` parents (0..N-1). */
    slotIndex?: number
  }
}[T]

export type BlockProps = Block

// ──────────────────────────── Page ────────────────────────────

export interface PageData {
  id: string
  title: string
  slug: string
  status: string
  blocks?: BlockProps[]
  metaTitle?: string | null
  metaDesc?: string | null
  ogImage?: string | null
  themeTokens?: ThemeTokens | null
  createdAt: Date
  updatedAt: Date
}

/** Per-page theme tokens — override the default DocBel palette for this page. */
export interface ThemeTokens {
  primary?: string
  secondary?: string
  accent?: string
  background?: string
  foreground?: string
  muted?: string
  border?: string
  fontFamily?: string
  radius?: number
}
