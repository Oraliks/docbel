import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { setToolActive } from '@/lib/tools-active'
import { PARTNER_TYPES, parseAccessRules } from '@/lib/entitlements'
import { z } from 'zod'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const tool = await prisma.tool.findUnique({
      where: { slug },
      include: { section: true },
    })

    if (!tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 })
    }

    return NextResponse.json(tool, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (error) {
    console.error('Error fetching tool:', error)
    return NextResponse.json({ error: 'Failed to fetch tool' }, { status: 500 })
  }
}

const patchSchema = z.object({
  active: z.boolean().optional(),
  popular: z.boolean().optional(),
  order: z.number().int().optional(),
  // Réassignation de la section (= colonne "Catégorie" côté admin). Le client
  // ne propose que des ids de section existants ; un id invalide ferait
  // échouer la FK Prisma (rejeté proprement par le try/catch).
  sectionId: z.string().trim().min(1).optional(),
  // Champs éditoriaux — admin uniquement. Bornes raisonnables pour éviter
  // d'écraser un champ par erreur (UI inline edit envoie ces champs).
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(1).max(600).optional(),
  // Nom d'icône lucide (ex: "Calculator") ou emoji court (1-4 chars).
  // Null pour retirer l'icône. Validation laxiste : le picker côté admin
  // borne déjà à des valeurs sensées.
  icon: z.string().trim().min(1).max(64).nullable().optional(),
  // Audience minimale qui peut voir l'outil. Cf. lib/audience.ts pour la
  // hiérarchie (citoyen < employeur < partenaire). Reste le fallback legacy
  // quand `access` est vide (cf. lib/entitlements.ts → effectiveRules).
  audience: z.enum(['citoyen', 'employeur', 'partenaire']).optional(),
  // Modèle d'accès set-based : tableau de règles { segment, partnerType? }.
  // Validation de forme ici, puis re-sanitisation via parseAccessRules avant
  // persistance (filtre les segments/sous-types inconnus, normalise null).
  access: z
    .array(
      z.object({
        segment: z.enum(['citoyen', 'employeur', 'partenaire']),
        partnerType: z.enum(PARTNER_TYPES).nullish(),
      })
    )
    .optional(),
})

/**
 * PATCH /api/tools/[slug] — admin-only.
 * Met à jour les champs admin du Tool (active, popular, order…). Utilisé
 * par le toggle Switch sur /admin/chomage/outils.
 */
/**
 * DELETE /api/tools/[slug] — admin-only.
 * Supprime l'outil. Pas de soft-delete : si l'admin veut juste cacher, il a
 * déjà le toggle active. La suppression est définitive.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    const role = (session?.user as { role?: string } | undefined)?.role
    if (!session || role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { slug } = await params
    const tool = await prisma.tool.findUnique({
      where: { slug },
      select: { id: true, name: true },
    })
    if (!tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 })
    }

    await prisma.tool.delete({ where: { id: tool.id } })
    return NextResponse.json({ deleted: tool.name, slug })
  } catch (error) {
    console.error('Error deleting tool:', error)
    return NextResponse.json({ error: 'Failed to delete tool' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    const role = (session?.user as { role?: string } | undefined)?.role
    if (!session || role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { slug } = await params
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Body invalide', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    // `active` n'est pas dans le client Prisma tant que db:generate n'a pas
    // tourné après la migration. On le passe en raw SQL pour s'assurer que
    // le toggle persiste vraiment. Les autres champs vont par la voie normale.
    const { active, access, ...rest } = parsed.data
    if (typeof active === 'boolean') {
      await setToolActive(slug, active)
    }

    // `access` (Json) : re-sanitise via parseAccessRules pour ne persister que
    // des règles valides (segments connus, partnerType normalisé en null si
    // absent/invalide). `audience` legacy reste géré tel quel dans `rest` —
    // c'est le fallback quand `access` est vide.
    const data: Record<string, unknown> = { ...rest }
    if (access !== undefined) {
      data.access = parseAccessRules(access)
    }

    let updated = null
    if (Object.keys(data).length > 0) {
      updated = await prisma.tool.update({
        where: { slug },
        // Cast : le client Prisma régénéré peut ne pas encore typer `access`
        // (Json) tant que db:generate n'a pas tourné (cf. tools-active.ts).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any,
      })
    }

    return NextResponse.json({ ok: true, slug, active, ...updated })
  } catch (error) {
    // Slug inexistant (course avec une suppression / refresh en retard) →
    // Prisma lève P2025 sur update. On le mappe en 404 explicite plutôt qu'un
    // 500 générique, cohérent avec le DELETE de cette route.
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 })
    }
    console.error('Error patching tool:', error)
    return NextResponse.json({ error: 'Failed to patch tool' }, { status: 500 })
  }
}
