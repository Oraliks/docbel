// =====================================================================
//  Blocs ONEM — schémas Zod (server-safe, sans React)
// ---------------------------------------------------------------------
//  Réexporte le schéma de la page eC3.2 sous la forme attendue par le
//  schema-registry. La source de vérité reste `lib/ec32/schema.ts`.
// =====================================================================

import { ec32BlockSchema } from '@/lib/ec32/schema'

export const onemSchemas = {
  ec32Page: ec32BlockSchema,
} as const
