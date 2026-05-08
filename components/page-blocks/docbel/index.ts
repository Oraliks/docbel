import { document } from './document'
import { steps } from './steps'
import { organisme } from './organisme'
import { glossary } from './glossary'
import { counter } from './counter'
import { collection } from './collection'
import { form } from './form'

export const docbelBlocks = {
  document,
  steps,
  organisme,
  glossary,
  counter,
  collection,
  form,
} as const
