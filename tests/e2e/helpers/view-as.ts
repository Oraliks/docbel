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
  await expect(account).toBeVisible({ timeout: 15_000 })
  await account.click()

  const trigger = page.getByRole("menuitem", { name: /voir en tant que/i })
  await expect(trigger).toBeVisible({ timeout: 10_000 })
  await trigger.click()
}
