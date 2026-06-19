// =====================================================================
//  Block Schema Registry (pure) — server-safe aggregation of every
//  block's Zod props schema, keyed by block type.
//
//  This mirrors REGISTRY in ./registry.ts, but imports ONLY the Zod
//  schemas (from each category's `schemas.ts`), never the React block
//  components. That keeps it free of `'use client'` modules so server
//  code (page validation) can build a validator from the same schemas
//  the editor uses — no duplication, no client bundle on the server.
// =====================================================================

import type { ZodTypeAny } from 'zod'
import { textSchemas } from '@/components/page-blocks/text/schemas'
import { textExtraSchemas } from '@/components/page-blocks/text-extra/schemas'
import { layoutSchemas } from '@/components/page-blocks/layout/schemas'
import { mediaSchemas } from '@/components/page-blocks/media/schemas'
import { mediaExtraSchemas } from '@/components/page-blocks/media-extra/schemas'
import { uiSchemas } from '@/components/page-blocks/ui/schemas'
import { marketingSchemas } from '@/components/page-blocks/marketing/schemas'
import { marketingExtraSchemas } from '@/components/page-blocks/marketing-extra/schemas'
import { docbelSchemas } from '@/components/page-blocks/docbel/schemas'
import { docbelExtraSchemas } from '@/components/page-blocks/docbel-extra/schemas'
import { chartsSchemas } from '@/components/page-blocks/charts/schemas'
import { engagementSchemas } from '@/components/page-blocks/engagement/schemas'
import { navigationSchemas } from '@/components/page-blocks/navigation/schemas'
import { editorialSchemas } from '@/components/page-blocks/editorial/schemas'
import { utilitySchemas } from '@/components/page-blocks/utility/schemas'
import { flexibleSchemas } from '@/components/page-blocks/flexible/schemas'
import { globalSchemas } from '@/components/page-blocks/global/schemas'
import { onemSchemas } from '@/components/page-blocks/onem/schemas'

/** Block type → Zod schema for that block's `props`. */
export const BLOCK_SCHEMAS: Record<string, ZodTypeAny> = {
  ...textSchemas,
  ...textExtraSchemas,
  ...layoutSchemas,
  ...mediaSchemas,
  ...mediaExtraSchemas,
  ...uiSchemas,
  ...marketingSchemas,
  ...marketingExtraSchemas,
  ...docbelSchemas,
  ...docbelExtraSchemas,
  ...chartsSchemas,
  ...engagementSchemas,
  ...navigationSchemas,
  ...editorialSchemas,
  ...utilitySchemas,
  ...flexibleSchemas,
  ...globalSchemas,
  ...onemSchemas,
}
