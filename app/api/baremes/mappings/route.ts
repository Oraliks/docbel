import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { ensureWriteAllowed } from '@/lib/admin/readonly-guard'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

const VALID_PARSER_TYPES = [
  'allocation_matrix',
  'salary_brackets',
  'basic_amounts',
  'hourly_wages',
  'allocation_w',
  'other_unemployment_amounts',
  'activation',
  'other_allocations',
  'employment_bonus',
] as const

const VALID_CATEGORIES = [
  'full_unemployment',
  'half_unemployment',
  'temporary_unemployment_full',
  'temporary_unemployment_half',
  'special_category_full',
  'special_category_half',
  'salary_bracket',
  'hourly_wage',
  'allocation_w',
  'other_unemployment_amount',
  'activation',
  'other_allocation',
  'employment_bonus',
  'basic_amount',
] as const

const createSchema = z.object({
  sheetName: z.string().min(1).max(100),
  fileType: z.string().default('onem-rates'),
  parserType: z.enum(VALID_PARSER_TYPES),
  category: z.enum(VALID_CATEGORIES),
  config: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().optional(),
  enabled: z.boolean().default(true),
})

export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  const mappings = await withDbRetry(() =>
    prisma.baremeSheetMapping.findMany({
      orderBy: [{ enabled: 'desc' }, { sheetName: 'asc' }],
    })
  )
  return NextResponse.json({ mappings }, { headers: jsonHeaders })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  const writeGuard = await ensureWriteAllowed()
  if (writeGuard) return writeGuard

  try {
    const body = await req.json()
    const parsed = createSchema.parse(body)

    const created = await withDbRetry(() =>
      prisma.baremeSheetMapping.upsert({
        where: {
          sheetName_fileType: {
            sheetName: parsed.sheetName,
            fileType: parsed.fileType,
          },
        },
        update: {
          parserType: parsed.parserType,
          category: parsed.category,
          config: parsed.config as Prisma.InputJsonValue,
          notes: parsed.notes ?? null,
          enabled: parsed.enabled,
        },
        create: {
          sheetName: parsed.sheetName,
          fileType: parsed.fileType,
          parserType: parsed.parserType,
          category: parsed.category,
          config: parsed.config as Prisma.InputJsonValue,
          notes: parsed.notes ?? null,
          enabled: parsed.enabled,
          createdBy: auth.user.email,
        },
      })
    )

    return NextResponse.json({ mapping: created }, { status: 201, headers: jsonHeaders })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation', issues: err.issues },
        { status: 400, headers: jsonHeaders }
      )
    }
    console.error('[mappings] POST error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}
