import { expect, type Page } from "@playwright/test"

/** Échappe une chaîne destinée à une RegExp (les e-mails contiennent `.` et `+`). */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Localise le bouton du menu compte (sidebar) : avatar + nom + e-mail.
 * On cible l'e-mail plutôt que le nom — moins ambigu et stable dans le temps.
 */
export function accountMenuButton(page: Page, adminEmail: string) {
  return page.getByRole("button", {
    name: new RegExp(escapeRegExp(adminEmail), "i"),
  })
}

/**
 * Ouvre le sous-menu « Voir en tant que ».
 *
 * ⚠️ Ce menu n'est PLUS un bouton autonome du header : `ViewAsMenu` n'est monté
 * qu'en `variant="submenu"`, dans le menu compte de la sidebar
 * (cf. components/nav-user.tsx). Il faut donc ouvrir ce menu d'abord, puis
 * déclencher le sous-menu — qui est un `DropdownMenuSubTrigger`, donc un
 * `menuitem` et non un `button`.
 *
 * L'ouverture du sous-menu déclenche le fetch de /api/admin/demo-accounts.
 */
export async function openViewAsMenu(page: Page, adminEmail: string) {
  const account = accountMenuButton(page, adminEmail)
  await expect(account).toBeVisible({ timeout: 30_000 })

  const trigger = page.getByRole("menuitem", { name: /voir en tant que/i })

  // Le bouton est dans le DOM dès le SSR, mais en dev React peut ne pas être
  // encore hydraté : le clic part alors dans le vide, sans erreur. On réessaie
  // jusqu'à ce que le sous-menu apparaisse.
  // ⚠️ On ne reclique QUE si le menu n'est pas déjà ouvert — un second clic sur
  // le déclencheur le refermerait (bascule).
  await expect(async () => {
    if (!(await trigger.isVisible())) {
      await account.click()
    }
    await expect(trigger).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 90_000 })

  await trigger.click()
}
