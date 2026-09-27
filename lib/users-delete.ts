import { prisma } from "@/lib/prisma"
import { ANONYMIZATION_RESET_FIELDS } from "@/lib/bundles/retention"

/**
 * Suppression administrative du compte et des données de préremplissage.
 * Les références libres n'ont pas de cascade SQL : elles sont traitées dans
 * la même transaction que User. Un échec annule donc aussi la suppression.
 *
 * Les réservations/listes d'attente restent utilisables via leurs tokens et
 * suivent leur politique de conservation existante : seule la référence au
 * compte est retirée ici. Ce chemin ne constitue pas leur effacement RGPD.
 * Les relations déclarées de User (Account, sessions, données employeur…)
 * sont supprimées par leurs cascades existantes.
 */
export async function deleteUserAndPersonalData(userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.userProfile.deleteMany({ where: { userId } })
    await tx.pdfFormDraft.deleteMany({ where: { userId } })
    await tx.bundleRun.updateMany({
      where: { userId },
      data: { ...ANONYMIZATION_RESET_FIELDS, anonymizedAt: new Date() },
    })
    await tx.booking.updateMany({ where: { userId }, data: { userId: null } })
    await tx.bookingWaitlist.updateMany({ where: { userId }, data: { userId: null } })

    // Les sessions créées PAR un admin impersonateur ne sont pas couvertes
    // par la cascade userId : les retirer aussi à la suppression de cet admin.
    await tx.session.deleteMany({
      where: { OR: [{ userId }, { impersonatedBy: userId }] },
    })
    return tx.user.delete({ where: { id: userId } })
  })
}
