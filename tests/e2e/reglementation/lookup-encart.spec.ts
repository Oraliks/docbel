import { test, expect } from "@playwright/test"

import { loginAsAdmin, requireAdminCredentials } from "../helpers/auth"

/**
 * QA de l'encart « Codes ONEM liés » sur les fiches article RioLex
 * (`/partenaire/reglementation/[riolexId]`).
 *
 * Vérifie les DEUX ponts de mapping produits par `scripts/generate-lookup-refs.ts` :
 *   - pont code#→article# (art. 110 → codes d'indemnisation, deep-link `?code=`) ;
 *   - pont thématique (art. 168bis → tables de vérification, lien « table entière »).
 *
 * Et surtout l'INTÉGRATION dans le vrai layout authentifié (ProShell + grille
 * 2 colonnes), que seul un test connecté peut voir.
 *
 * Pré-requis :
 *   - Dev server lancé sur localhost:3000 (cf. feedback_dev_server_env)
 *   - E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD sur un VRAI compte admin existant
 *     (sinon le test se skip proprement)
 *   - Mappings appliqués en base (`pnpm attach:lookup-refs`)
 */

interface Case {
  rid: string;
  label: string;
  /** Table Lookup attendue derrière au moins un lien de l'encart. */
  table: string;
  /** Codes attendus en badge (pont code#). Vide = pont thématique. */
  codes: string[];
  /** true = liens « table entière » (sans `?code=`). */
  wholeTable: boolean;
}

const CASES: Case[] = [
  {
    rid: "25_11_1991-1-art_110",
    label: "art. 110 — codes d'indemnisation (pont code#→article#)",
    table: "s04-s36-article-indemnisation",
    codes: ["110&2", "110&3", "110&4", "110,4", "110&1A"],
    wholeTable: false,
  },
  {
    rid: "25_11_1991-1-art_168bis",
    label: "art. 168bis — tables de vérification (pont thématique)",
    table: "verif168bis-rejection",
    codes: [],
    wholeTable: true,
  },
]

test.describe("Réglementation — encart « Codes ONEM liés »", () => {
  for (const c of CASES) {
    test(c.label, async ({ page, request }) => {
      const creds = requireAdminCredentials(test)
      await loginAsAdmin(page, request, creds)

      // Large viewport : la grille passe en 2 colonnes à `lg`, et le ProShell
      // consomme de la largeur — on garantit qu'on est au-dessus du breakpoint.
      await page.setViewportSize({ width: 1600, height: 900 })
      await page.goto(`/partenaire/reglementation/${c.rid}`)

      // La page est gated : sans session valide, `notFound()` → pas de sidebar.
      const aside = page.locator("aside").first()
      await expect(aside).toBeVisible()

      // 1) L'encart est rendu dans la sidebar.
      await expect(aside.getByText("Codes ONEM liés", { exact: true })).toBeVisible()

      // 2) Au moins un lien pointe vers la bonne table de l'outil Lookup.
      const tableLink = aside.locator(`a[href*="${c.table}"]`).first()
      await expect(tableLink).toBeVisible()

      // 3) Forme du deep-link selon le pont.
      const href = (await tableLink.getAttribute("href")) ?? ""
      if (c.wholeTable) {
        // Pont thématique : lien vers la table entière, sans code précis.
        expect(href).not.toContain("?code=")
      } else {
        // Pont code# : au moins un lien porte le paramètre `code`.
        const coded = aside.locator('a[href*="/outils/lookup-onem/"][href*="?code="]')
        expect(await coded.count()).toBeGreaterThan(0)
      }

      // 4) Les codes attendus apparaissent en badge.
      for (const code of c.codes) {
        await expect(aside.getByText(code, { exact: true })).toBeVisible()
      }

      // 5) INTÉGRATION dans le layout réel : colonne droite 320px, collante,
      //    encart placé avant la carte « Propriétés ».
      const layout = await page.evaluate(() => {
        const el = document.querySelector("aside")
        if (!el) return null
        const cs = getComputedStyle(el)
        const cards = Array.from(el.children).map((k) =>
          (k.textContent || "").replace(/\s+/g, " ").trim()
        )
        return {
          width: Math.round(el.getBoundingClientRect().width),
          position: cs.position,
          encartIndex: cards.findIndex((t) => t.startsWith("Codes ONEM liés")),
          propsIndex: cards.findIndex((t) => t.startsWith("Propriétés")),
        }
      })

      expect(layout).not.toBeNull()
      expect(layout!.width).toBe(320)
      expect(layout!.position).toBe("sticky")
      expect(layout!.encartIndex).toBeGreaterThanOrEqual(0)
      // L'encart précède « Propriétés » (ordre voulu dans ArticleSidebar).
      expect(layout!.encartIndex).toBeLessThan(layout!.propsIndex)

      // 6) Preuve visuelle (test-results/ est gitignoré).
      //    Capture au viewport et NON `fullPage` : ces articles sont très longs
      //    (art. 110 ≈ 3900 px avec ses 20 commentaires ONEM) et le rendu plein
      //    écran dépassait le timeout de 60 s quand toute la suite tourne.
      //    L'encart est haut dans la sidebar, donc visible sans défilement.
      await page.screenshot({ path: `test-results/lookup-encart-${c.rid}.png` })
    })
  }
})
