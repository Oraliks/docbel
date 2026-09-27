import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  tx: {
    userProfile: { deleteMany: vi.fn() },
    pdfFormDraft: { deleteMany: vi.fn() },
    bundleRun: { updateMany: vi.fn() },
    booking: { updateMany: vi.fn() },
    bookingWaitlist: { updateMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    user: { delete: vi.fn() },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }))

import { deleteUserAndPersonalData } from "../users-delete"
import { ANONYMIZATION_RESET_FIELDS } from "../bundles/retention"

describe("suppression transactionnelle d'un compte", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.transaction.mockImplementation(async (operation) => operation(mocks.tx))
    mocks.tx.user.delete.mockResolvedValue({ id: "user-1" })
  })

  it("nettoie les données sans FK avant de supprimer le compte dans la même transaction", async () => {
    await expect(deleteUserAndPersonalData("user-1")).resolves.toEqual({ id: "user-1" })
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.tx.userProfile.deleteMany).toHaveBeenCalledExactlyOnceWith({ where: { userId: "user-1" } })
    expect(mocks.tx.pdfFormDraft.deleteMany).toHaveBeenCalledExactlyOnceWith({ where: { userId: "user-1" } })
    expect(mocks.tx.bundleRun.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { userId: "user-1" },
      data: { ...ANONYMIZATION_RESET_FIELDS, anonymizedAt: expect.any(Date) },
    })
    expect(mocks.tx.session.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { OR: [{ userId: "user-1" }, { impersonatedBy: "user-1" }] },
    })
    expect(mocks.tx.user.delete).toHaveBeenCalledExactlyOnceWith({ where: { id: "user-1" } })
    expect(mocks.tx.userProfile.deleteMany.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.tx.user.delete.mock.invocationCallOrder[0])
  })

  it("délie les réservations et listes d'attente sans changer leur statut, contenu ou token", async () => {
    await deleteUserAndPersonalData("user-1")
    const unlinkOnly = { where: { userId: "user-1" }, data: { userId: null } }
    expect(mocks.tx.booking.updateMany).toHaveBeenCalledExactlyOnceWith(unlinkOnly)
    expect(mocks.tx.bookingWaitlist.updateMany).toHaveBeenCalledExactlyOnceWith(unlinkOnly)
  })

  it("propage un échec de nettoyage à la transaction sans supprimer le compte", async () => {
    const failure = new Error("Simulated profile failure")
    mocks.tx.userProfile.deleteMany.mockRejectedValue(failure)
    await expect(deleteUserAndPersonalData("user-1")).rejects.toBe(failure)
    expect(mocks.tx.bundleRun.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.user.delete).not.toHaveBeenCalled()
  })

  it("propage un échec final pour permettre le rollback des données nettoyées", async () => {
    const failure = new Error("Simulated account deletion failure")
    mocks.tx.user.delete.mockRejectedValue(failure)
    await expect(deleteUserAndPersonalData("user-1")).rejects.toBe(failure)
    expect(mocks.tx.userProfile.deleteMany).toHaveBeenCalledOnce()
    expect(mocks.tx.bundleRun.updateMany).toHaveBeenCalledOnce()
  })
})
