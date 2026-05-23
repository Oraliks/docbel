// Importe les 581 communes belges officielles depuis Statbel REFNIS.
// Source : https://statbel.fgov.be/sites/default/files/files/opendata/REFNIS%20code/TU_COM_REFNIS.zip
//
// Structure REFNIS :
//  - LVL 1 = Région (02000 Flandre, 03000 Wallonie, 04000 Bruxelles)
//  - LVL 2 = Province
//  - LVL 3 = Arrondissement administratif
//  - LVL 4 = Commune (parent = arrondissement)
//
// Upsert non-destructif sur Commune (insCode unique) — préserve lat/lng et autres
// enrichissements existants.
//
// Usage :
//   pnpm communes:import-refnis          (dry-run)
//   pnpm communes:import-refnis --yes    (applique)

import AdmZip from 'adm-zip'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')
const URL = 'https://statbel.fgov.be/sites/default/files/files/opendata/REFNIS%20code/TU_COM_REFNIS.zip'

// Communes germanophones (Communauté germanophone — sous-région de Wallonie)
const GERMANOPHONE_INS = new Set([
  '63012', '63023', '63035', '63040', '63045', '63057', '63067', '63072', '63087',
])

interface RefnisRow {
  lvl: number
  code: string
  parent: string
  nameDe: string
  nameFr: string
  nameNl: string
  endDate: string
}

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}\n`)

  const workDir = path.join(os.tmpdir(), 'beldoc-refnis')
  await mkdir(workDir, { recursive: true })
  const zipPath = path.join(workDir, 'refnis.zip')
  const txtPath = path.join(workDir, 'TU_COM_REFNIS.txt')

  if (!existsSync(txtPath)) {
    console.log(`Téléchargement : ${URL}`)
    const res = await fetch(URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await writeFile(zipPath, Buffer.from(await res.arrayBuffer()))
    const zip = new AdmZip(zipPath)
    zip.extractEntryTo('TU_COM_REFNIS.txt', workDir, false, true)
  }

  const raw = await readFile(txtPath, 'utf-8')
  const rows = parseRefnis(raw)
  console.log(`${rows.length} entrées REFNIS au total`)

  // Construit la hiérarchie : commune (LVL4) → arrondissement (LVL3) →
  //                          province (LVL2) → région (LVL1)
  const byCode = new Map(rows.map((r) => [r.code, r]))

  const communes = rows.filter((r) => r.lvl === 4 && r.endDate === '31/12/9999')
  console.log(`${communes.length} communes actives au ${new Date().toLocaleDateString('fr-BE')}`)

  // Précharge existant pour stats
  const existing = await prisma.commune.findMany({ select: { insCode: true } })
  const existingSet = new Set(existing.map((c) => c.insCode))
  let creates = 0
  let updates = 0

  type Action = {
    insCode: string
    nameFr: string
    nameNl: string
    nameDe: string | null
    region: 'flanders' | 'wallonia' | 'brussels' | 'germanophone'
    province: string | null
    arrondissement: string | null
    isNew: boolean
  }
  const actions: Action[] = []

  for (const com of communes) {
    const arr = byCode.get(com.parent)
    const prov = arr ? byCode.get(arr.parent) : null
    const reg = prov ? byCode.get(prov.parent) : null
    const regionEnum: Action['region'] = GERMANOPHONE_INS.has(com.code)
      ? 'germanophone'
      : regionFromRefnis(reg?.code)
    actions.push({
      insCode: com.code,
      nameFr: com.nameFr || com.nameNl,
      nameNl: com.nameNl || com.nameFr,
      nameDe: com.nameDe || null,
      region: regionEnum,
      province: prov?.nameFr ?? null,
      arrondissement: arr?.nameFr ?? null,
      isNew: !existingSet.has(com.code),
    })
    if (existingSet.has(com.code)) updates++
    else creates++
  }

  console.log(`  ${updates} updates (existantes), ${creates} créations`)
  // Échantillon
  console.log('  Échantillon créations :')
  for (const a of actions.filter((a) => a.isNew).slice(0, 5)) {
    console.log(`    ${a.insCode} | ${a.nameFr.padEnd(30)} | ${a.region}`)
  }

  if (!APPLY) {
    console.log('\nDry-run. Passe --yes pour appliquer.')
    return
  }

  console.log('\n🔥 Application…')
  let done = 0
  for (const a of actions) {
    await prisma.commune.upsert({
      where: { insCode: a.insCode },
      create: {
        insCode: a.insCode,
        nameFr: a.nameFr,
        nameNl: a.nameNl,
        nameDe: a.nameDe,
        region: a.region,
        province: a.province,
      },
      update: {
        nameFr: a.nameFr,
        nameNl: a.nameNl,
        nameDe: a.nameDe,
        region: a.region,
        province: a.province,
      },
    })
    done++
    if (done % 100 === 0) process.stdout.write(`\r  ${done}/${actions.length}`)
  }
  process.stdout.write(`\r  ${done}/${actions.length}\n`)
  console.log('✓ Done')
}

function parseRefnis(raw: string): RefnisRow[] {
  // Strip BOM + split lignes
  const text = raw.replace(/^﻿/, '')
  const lines = text.split(/\r?\n/).filter(Boolean)
  const rows: RefnisRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('|')
    if (parts.length < 8) continue
    rows.push({
      lvl: parseInt(parts[0], 10),
      code: parts[1].trim(),
      parent: parts[2].trim(),
      nameDe: parts[3].trim(),
      nameFr: parts[4].trim(),
      nameNl: parts[5].trim(),
      endDate: parts[7].trim(),
    })
  }
  return rows
}

function regionFromRefnis(code: string | undefined): 'flanders' | 'wallonia' | 'brussels' {
  if (code === '02000') return 'flanders'
  if (code === '04000') return 'brussels'
  return 'wallonia'
}

main().catch(console.error).finally(() => prisma.$disconnect())
