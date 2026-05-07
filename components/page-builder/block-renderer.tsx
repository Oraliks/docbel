'use client'

import React from 'react'
import type { BlockProps, DeviceType } from '@/lib/page-builder/types'
import {
  blockToCSS,
  blockToClassName,
  blockAttrs,
} from '@/lib/page-builder/block-styles'
import { interpolateBlock, type InterpolationContext } from '@/lib/page-builder/interpolate'
import { cn } from '@/lib/utils'

import {
  HeadingBlock,
  TextBlock,
  QuoteBlock,
  DividerBlock,
  SpacerBlock,
} from '@/components/page-blocks/text-blocks'
import {
  ImageBlock,
  VideoBlock,
  GalleryBlock,
  EmbedBlock,
} from '@/components/page-blocks/media-blocks'
import {
  SectionBlock,
  ContainerBlock,
  ColumnsBlock,
} from '@/components/page-blocks/layout-blocks'
import {
  HeroBlock,
  FeaturesBlock,
  CtaBlock,
  FaqBlock,
  TestimonialBlock,
  StatsBlock,
} from '@/components/page-blocks/marketing-blocks'
import {
  CardBlock,
  AccordionBlock,
  TabsBlock,
  AlertBlock,
  BadgesBlock,
  ProgressBlock,
  ButtonGroupBlock,
} from '@/components/page-blocks/ui-blocks'
import {
  DocumentBlock,
  StepsBlock,
  OrganismeBlock,
  GlossaryBlock,
  CounterBlock,
  CollectionBlock,
  FormBlock,
} from '@/components/page-blocks/docbel-blocks'
import {
  CodeBlockBlock,
  PullQuoteBlock,
  DropCapBlock,
  DefinitionListBlock,
  HighlightBlock,
  ProsConsBlock,
  ChecklistBlock,
} from '@/components/page-blocks/text-extra-blocks'
import {
  AudioBlock,
  CarouselBlock,
  BeforeAfterBlock,
  LogoWallBlock,
  SvgIllustrationBlock,
} from '@/components/page-blocks/media-extra-blocks'
import {
  BarChartBlock,
  LineChartBlock,
  PieChartBlock,
  KpiCardBlock,
  SparklineBlock,
  HeatmapBlock,
  ChronologyBlock,
} from '@/components/page-blocks/chart-blocks'
import {
  PricingTableBlock,
  CompareTableBlock,
  CountdownBlock,
  NotificationBarBlock,
  NewsletterBlock,
  TrustBadgesBlock,
  PressMentionsBlock,
  StarRatingBlock,
} from '@/components/page-blocks/marketing-extra-blocks'
import {
  QuizBlock,
  PollBlock,
  CalculatorBlock,
  ReactionsBlock,
  ShareButtonsBlock,
} from '@/components/page-blocks/engagement-blocks'
import {
  OpeningHoursBlock,
  LastUpdatedBlock,
  TableOfContentsBlock,
  AnchorMenuBlock,
  BackToTopBlock,
  ReadingProgressBlock,
  ArticleHeaderBlock,
  AuthorBioBlock,
  SponsoredDisclosureBlock,
} from '@/components/page-blocks/nav-blocks'
import {
  BelgianDateHelperBlock,
  TarifsTableBlock,
  EligibilityTestBlock,
  LawCitationBlock,
  CasePracticeBlock,
  RequiredDocsBlock,
  LegalDelayBlock,
} from '@/components/page-blocks/docbel-extra-blocks'
import {
  HtmlRawBlock,
  CustomCssBlock,
  GdprNoticeBlock,
  MapEmbedBlock,
  MarqueeBlock,
  TiltCardBlock,
  ImageHotspotsBlock,
} from '@/components/page-blocks/utility-blocks'
import {
  BentoGridBlock,
  SplitSectionBlock,
  StickyDuoBlock,
  FlexContainerBlock,
  MagazineColumnsBlock,
  RadarChartBlock,
  FunnelChartBlock,
  GaugeBlock,
  StackedBarBlock,
  MultiLineBlock,
  SpoilerBlock,
  AsideBlock,
  EditorNoteBlock,
  DialogBlockBlock,
  DiffViewerBlock,
  MathLatexBlock,
  FeedbackBarBlock,
  SuggestionBoxBlock,
  MultiStepFormBlock,
  DonationBlock,
  SalaireNetBEBlock,
  PreavisCCT109Block,
  AllocationsFamilialesBlock,
  PostalToCommuneBlock,
  BceValidatorBlock,
  GradientMeshBlock,
  SectionDividerBlock,
  GlassCardBlock,
  TypewriterBlock,
  KenBurnsBlock,
  ParticlesBlock,
  NewsTickerBlock,
  FlashcardsBlock,
  TtsButtonBlock,
  A11yToolbarBlock,
} from '@/components/page-blocks/flexible-blocks'

interface BlockRendererProps {
  block: BlockProps
  device?: DeviceType
  /** Children for `section` and `container`. */
  slot?: React.ReactNode
  /** For `columns`: returns children for a given column index. */
  slotByIndex?: (idx: number) => React.ReactNode
  /** When true (in editor), conditional rendering / hidden flag are ignored so the user can still edit. */
  editorMode?: boolean
  /** Active session info, for conditional rendering on the public side. */
  loggedIn?: boolean
  /** Variable interpolation context — `{{page.title}}`, `{{today}}`, etc. */
  interpolationContext?: InterpolationContext
}

function BlockContent({
  block,
  slot,
  slotByIndex,
}: {
  block: BlockProps
  slot?: React.ReactNode
  slotByIndex?: (idx: number) => React.ReactNode
}) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock {...block.props} />
    case 'text':
      return <TextBlock {...block.props} />
    case 'quote':
      return <QuoteBlock {...block.props} />
    case 'divider':
      return <DividerBlock {...block.props} />
    case 'spacer':
      return <SpacerBlock {...block.props} />
    case 'image':
      return <ImageBlock {...block.props} />
    case 'video':
      return <VideoBlock {...block.props} />
    case 'gallery':
      return <GalleryBlock {...block.props} />
    case 'embed':
      return <EmbedBlock {...block.props} />
    case 'section':
      return <SectionBlock {...block.props}>{slot}</SectionBlock>
    case 'container':
      return <ContainerBlock {...block.props}>{slot}</ContainerBlock>
    case 'columns':
      return (
        <ColumnsBlock {...block.props}>
          {Array.from({ length: block.props.count }).map((_, i) => (
            <React.Fragment key={i}>{slotByIndex?.(i)}</React.Fragment>
          ))}
        </ColumnsBlock>
      )
    case 'hero':
      return <HeroBlock {...block.props} />
    case 'features':
      return <FeaturesBlock {...block.props} />
    case 'cta':
      return <CtaBlock {...block.props} />
    case 'faq':
      return <FaqBlock {...block.props} />
    case 'testimonial':
      return <TestimonialBlock {...block.props} />
    case 'stats':
      return <StatsBlock {...block.props} />
    case 'card':
      return <CardBlock {...block.props} />
    case 'accordion':
      return <AccordionBlock {...block.props} />
    case 'tabs':
      return <TabsBlock {...block.props} />
    case 'alert':
      return <AlertBlock {...block.props} />
    case 'badges':
      return <BadgesBlock {...block.props} />
    case 'progress':
      return <ProgressBlock {...block.props} />
    case 'buttonGroup':
      return <ButtonGroupBlock {...block.props} />
    case 'document':
      return <DocumentBlock {...block.props} />
    case 'steps':
      return <StepsBlock {...block.props} />
    case 'organisme':
      return <OrganismeBlock {...block.props} />
    case 'glossary':
      return <GlossaryBlock {...block.props} />
    case 'counter':
      return <CounterBlock {...block.props} />
    case 'collection':
      return <CollectionBlock {...block.props} />
    case 'form':
      return <FormBlock {...block.props} />
    // text-extra
    case 'codeBlock':
      return <CodeBlockBlock {...block.props} />
    case 'pullQuote':
      return <PullQuoteBlock {...block.props} />
    case 'dropCap':
      return <DropCapBlock {...block.props} />
    case 'definitionList':
      return <DefinitionListBlock {...block.props} />
    case 'highlight':
      return <HighlightBlock {...block.props} />
    case 'prosCons':
      return <ProsConsBlock {...block.props} />
    case 'checklist':
      return <ChecklistBlock {...block.props} />
    // media-extra
    case 'audio':
      return <AudioBlock {...block.props} />
    case 'carousel':
      return <CarouselBlock {...block.props} />
    case 'beforeAfter':
      return <BeforeAfterBlock {...block.props} />
    case 'logoWall':
      return <LogoWallBlock {...block.props} />
    case 'svgIllustration':
      return <SvgIllustrationBlock {...block.props} />
    // charts
    case 'barChart':
      return <BarChartBlock {...block.props} />
    case 'lineChart':
      return <LineChartBlock {...block.props} />
    case 'pieChart':
      return <PieChartBlock {...block.props} />
    case 'kpiCard':
      return <KpiCardBlock {...block.props} />
    case 'sparkline':
      return <SparklineBlock {...block.props} />
    case 'heatmap':
      return <HeatmapBlock {...block.props} />
    case 'chronology':
      return <ChronologyBlock {...block.props} />
    // marketing-extra
    case 'pricingTable':
      return <PricingTableBlock {...block.props} />
    case 'compareTable':
      return <CompareTableBlock {...block.props} />
    case 'countdown':
      return <CountdownBlock {...block.props} />
    case 'notificationBar':
      return <NotificationBarBlock {...block.props} />
    case 'newsletter':
      return <NewsletterBlock {...block.props} />
    case 'trustBadges':
      return <TrustBadgesBlock {...block.props} />
    case 'pressMentions':
      return <PressMentionsBlock {...block.props} />
    case 'starRating':
      return <StarRatingBlock {...block.props} />
    // engagement
    case 'quiz':
      return <QuizBlock {...block.props} />
    case 'poll':
      return <PollBlock {...block.props} />
    case 'calculator':
      return <CalculatorBlock {...block.props} />
    case 'reactions':
      return <ReactionsBlock {...block.props} />
    case 'shareButtons':
      return <ShareButtonsBlock {...block.props} />
    // nav/time
    case 'openingHours':
      return <OpeningHoursBlock {...block.props} />
    case 'lastUpdated':
      return <LastUpdatedBlock {...block.props} />
    case 'tableOfContents':
      return <TableOfContentsBlock {...block.props} />
    case 'anchorMenu':
      return <AnchorMenuBlock {...block.props} />
    case 'backToTop':
      return <BackToTopBlock {...block.props} />
    case 'readingProgress':
      return <ReadingProgressBlock {...block.props} />
    // editorial
    case 'articleHeader':
      return <ArticleHeaderBlock {...block.props} />
    case 'authorBio':
      return <AuthorBioBlock {...block.props} />
    case 'sponsoredDisclosure':
      return <SponsoredDisclosureBlock {...block.props} />
    // docbel-extra
    case 'belgianDateHelper':
      return <BelgianDateHelperBlock {...block.props} />
    case 'tarifsTable':
      return <TarifsTableBlock {...block.props} />
    case 'eligibilityTest':
      return <EligibilityTestBlock {...block.props} />
    case 'lawCitation':
      return <LawCitationBlock {...block.props} />
    case 'casePractice':
      return <CasePracticeBlock {...block.props} />
    case 'requiredDocs':
      return <RequiredDocsBlock {...block.props} />
    case 'legalDelay':
      return <LegalDelayBlock {...block.props} />
    // utility
    case 'htmlRaw':
      return <HtmlRawBlock {...block.props} />
    case 'customCss':
      return <CustomCssBlock {...block.props} />
    case 'gdprNotice':
      return <GdprNoticeBlock {...block.props} />
    case 'mapEmbed':
      return <MapEmbedBlock {...block.props} />
    case 'marquee':
      return <MarqueeBlock {...block.props} />
    case 'tiltCard':
      return <TiltCardBlock {...block.props} />
    case 'imageHotspots':
      return <ImageHotspotsBlock {...block.props} />
    // Layout-flex
    case 'bentoGrid':
      return <BentoGridBlock {...block.props} />
    case 'splitSection':
      return <SplitSectionBlock {...block.props}>{slot}</SplitSectionBlock>
    case 'stickyDuo':
      return <StickyDuoBlock {...block.props}>{slot}</StickyDuoBlock>
    case 'flexContainer':
      return <FlexContainerBlock {...block.props}>{slot}</FlexContainerBlock>
    case 'magazineColumns':
      return <MagazineColumnsBlock {...block.props} />
    // Charts-extra
    case 'radarChart':
      return <RadarChartBlock {...block.props} />
    case 'funnelChart':
      return <FunnelChartBlock {...block.props} />
    case 'gauge':
      return <GaugeBlock {...block.props} />
    case 'stackedBar':
      return <StackedBarBlock {...block.props} />
    case 'multiLine':
      return <MultiLineBlock {...block.props} />
    // Text-rich
    case 'spoiler':
      return <SpoilerBlock {...block.props} />
    case 'aside':
      return <AsideBlock {...block.props} />
    case 'editorNote':
      return <EditorNoteBlock {...block.props} />
    case 'dialogBlock':
      return <DialogBlockBlock {...block.props} />
    case 'diffViewer':
      return <DiffViewerBlock {...block.props} />
    case 'mathLatex':
      return <MathLatexBlock {...block.props} />
    // Engagement-extra
    case 'feedbackBar':
      return <FeedbackBarBlock {...block.props} />
    case 'suggestionBox':
      return <SuggestionBoxBlock {...block.props} />
    case 'multiStepForm':
      return <MultiStepFormBlock {...block.props} />
    case 'donation':
      return <DonationBlock {...block.props} />
    // DocBel calc
    case 'salaireNetBE':
      return <SalaireNetBEBlock {...block.props} />
    case 'preavisCCT109':
      return <PreavisCCT109Block {...block.props} />
    case 'allocationsFamiliales':
      return <AllocationsFamilialesBlock {...block.props} />
    case 'postalToCommune':
      return <PostalToCommuneBlock {...block.props} />
    case 'bceValidator':
      return <BceValidatorBlock {...block.props} />
    // Decorative
    case 'gradientMesh':
      return <GradientMeshBlock {...block.props} />
    case 'sectionDivider':
      return <SectionDividerBlock {...block.props} />
    case 'glassCard':
      return <GlassCardBlock {...block.props} />
    case 'typewriter':
      return <TypewriterBlock {...block.props} />
    case 'kenBurns':
      return <KenBurnsBlock {...block.props} />
    case 'particles':
      return <ParticlesBlock {...block.props} />
    case 'newsTicker':
      return <NewsTickerBlock {...block.props} />
    // Education / a11y
    case 'flashcards':
      return <FlashcardsBlock {...block.props} />
    case 'ttsButton':
      return <TtsButtonBlock {...block.props} />
    case 'a11yToolbar':
      return <A11yToolbarBlock {...block.props} />
    default:
      return null
  }
}

class BlockBoundary extends React.Component<
  { children: React.ReactNode; type: string },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode; type: string }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Erreur de rendu ({this.props.type}): {this.state.message}
        </div>
      )
    }
    return this.props.children
  }
}

/** Hook that returns true once the element has scrolled into view. */
function useEnterViewport(enabled: boolean) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [seen, setSeen] = React.useState(false)
  React.useEffect(() => {
    if (!enabled || seen) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [enabled, seen])
  return { ref, visible: !enabled || seen }
}

export function BlockRenderer({
  block,
  device = 'desktop',
  slot,
  slotByIndex,
  editorMode = false,
  loggedIn = false,
  interpolationContext,
}: BlockRendererProps) {
  // Apply variable interpolation to props (e.g. {{page.title}} → "À propos")
  const resolvedBlock = React.useMemo(() => {
    if (!interpolationContext) return block
    return interpolateBlock(block, interpolationContext)
  }, [block, interpolationContext])
  const css = blockToCSS(resolvedBlock, device)
  const className = blockToClassName(resolvedBlock)
  const attrs = blockAttrs(resolvedBlock)
  const animOnScroll = !!resolvedBlock.advanced?.animateOnScroll
  const { ref, visible } = useEnterViewport(animOnScroll && !editorMode)

  // Conditional rendering on public side
  if (!editorMode) {
    if (resolvedBlock.meta?.hidden) return null
    const cond = resolvedBlock.advanced?.showIf
    if (cond === 'loggedIn' && !loggedIn) return null
    if (cond === 'loggedOut' && loggedIn) return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        'block-renderer',
        className,
        animOnScroll && !visible && 'opacity-0',
        animOnScroll && visible && 'opacity-100'
      )}
      style={{
        ...css,
        animationDelay:
          resolvedBlock.advanced?.animationDelay !== undefined
            ? `${resolvedBlock.advanced.animationDelay}ms`
            : undefined,
        transition: animOnScroll ? 'opacity 0.7s ease-out' : undefined,
      }}
      {...attrs}
    >
      <BlockBoundary type={resolvedBlock.type}>
        <BlockContent block={resolvedBlock} slot={slot} slotByIndex={slotByIndex} />
      </BlockBoundary>
    </div>
  )
}
