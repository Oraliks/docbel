import { belgianDateHelper } from './belgian-date-helper'
import { tarifsTable } from './tarifs-table'
import { eligibilityTest } from './eligibility-test'
import { lawCitation } from './law-citation'
import { casePractice } from './case-practice'
import { requiredDocs } from './required-docs'
import { legalDelay } from './legal-delay'

export const docbelExtraBlocks = {
  belgianDateHelper,
  tarifsTable,
  eligibilityTest,
  lawCitation,
  casePractice,
  requiredDocs,
  legalDelay,
} as const
