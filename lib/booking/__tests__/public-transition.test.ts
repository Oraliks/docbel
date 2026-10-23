import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { BookingStatus } from "@prisma/client";
import { notifyNextWaiter } from "@/lib/booking/waitlist";
import { POST as cancel } from "@/app/api/booking/manage/[token]/cancel/route";
import { POST as reschedule } from "@/app/api/booking/manage/[token]/reschedule/route";
import { GET as readProfile } from "@/app/api/user/profile/route";

const io = vi.hoisted(() => ({
  session: vi.fn(), findBooking: vi.fn(), updateBooking: vi.fn(), createBooking: vi.fn(),
  countBookings: vi.fn(), findWaiting: vi.fn(), updateWaiting: vi.fn(),
  waitlistEmail: vi.fn(), confirmedEmail: vi.fn(), receivedEmail: vi.fn(),
  findProfile: vi.fn(), writeProfile: vi.fn(), deleteProfile: vi.fn(), log: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: io.session } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/admin/readonly-guard", () => ({ ensureWriteAllowed: async () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  booking: { findUnique: io.findBooking, update: io.updateBooking, create: io.createBooking, count: io.countBookings },
  bookingWaitlist: { findFirst: io.findWaiting, update: io.updateWaiting },
  userProfile: { findUnique: io.findProfile, upsert: io.writeProfile, deleteMany: io.deleteProfile },
  $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({ booking: {
    count: io.countBookings, update: io.updateBooking,
  } }),
} }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: io.log }));
vi.mock("@/lib/booking/emails", () => ({
  sendWaitlistOpening: io.waitlistEmail, sendBookingConfirmed: io.confirmedEmail,
  sendBookingReceived: io.receivedEmail,
}));
vi.mock("@/lib/booking/availability-data", () => ({
  findSlot: async () => ({ capacity: 1, endTime: "15:00", serviceCode: null }),
}));
vi.mock("@/lib/booking/ics-adapter", () => ({ icsForBooking: () => "fixture-ics" }));
vi.mock("@/lib/booking/route-bureau", () => ({ locationAddress: () => "Fixture address" }));

const TOKEN = "fixture-existing-management-token";
const params = { params: Promise.resolve({ token: TOKEN }) };
const request = (action: string, body?: unknown) => new NextRequest(`http://localhost:3000/api/booking/manage/${TOKEN}/${action}`, {
  method: "POST", headers: { "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

beforeEach(() => {
  vi.resetAllMocks();
  io.session.mockResolvedValue({ user: { id: "fixture-owner" } });
  io.findBooking.mockResolvedValue({
    id: "existing-booking", status: BookingStatus.confirmed, date: "2099-10-30", startTime: "09:00",
    tenantId: "tenant", locationId: "location", citizenName: "Fixture", citizenEmail: "fixture@example.test",
    locale: null, tenant: { name: "Fixture tenant", emailFromName: null, brandColor: null },
    location: { name: "Fixture location" },
  });
  io.countBookings.mockResolvedValue(0);
  io.findProfile.mockResolvedValue({ userId: "fixture-owner" });
});

describe("transition V1 — attente conservée et gestion existante maintenue", () => {
  it("suspend notifyNextWaiter avant toute lecture, mutation ou invitation", async () => {
    expect(await notifyNextWaiter("location", "2099-10-30", "09:00")).toBe(false);
    expect(io.findWaiting).not.toHaveBeenCalled();
    expect(io.updateWaiting).not.toHaveBeenCalled();
    expect(io.waitlistEmail).not.toHaveBeenCalled();
  });

  it("conserve l'annulation du RDV existant sous son token sans créer ni notifier un nouvel inscrit", async () => {
    const response = await cancel(request("cancel"), params);
    expect(response.status).toBe(200);
    expect(io.findBooking).toHaveBeenCalledWith(expect.objectContaining({ where: { confirmationToken: TOKEN } }));
    expect(io.updateBooking).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "existing-booking" }, data: expect.objectContaining({ status: BookingStatus.cancelled_citizen }),
    }));
    expect(io.createBooking).not.toHaveBeenCalled();
    expect(io.findWaiting).not.toHaveBeenCalled();
    expect(io.updateWaiting).not.toHaveBeenCalled();
    expect(io.waitlistEmail).not.toHaveBeenCalled();
  });

  it("conserve le report du même RDV et son email de confirmation, sans invitation waitlist", async () => {
    const response = await reschedule(request("reschedule", { date: "2099-11-01", startTime: "14:00" }), params);
    expect(response.status).toBe(200);
    expect(io.updateBooking).toHaveBeenCalledWith({ where: { id: "existing-booking" }, data: {
      date: "2099-11-01", startTime: "14:00", endTime: "15:00", serviceCode: null,
    } });
    expect(io.createBooking).not.toHaveBeenCalled();
    expect(io.confirmedEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "fixture@example.test", token: TOKEN }));
    expect(io.findWaiting).not.toHaveBeenCalled();
    expect(io.waitlistEmail).not.toHaveBeenCalled();
  });

  it("refuse un token sans RDV sans mutation ni notification", async () => {
    io.findBooking.mockResolvedValue(null);
    const response = await cancel(request("cancel"), params);
    expect(response.status).toBe(404);
    expect(io.updateBooking).not.toHaveBeenCalled();
    expect(io.createBooking).not.toHaveBeenCalled();
    expect(io.waitlistEmail).not.toHaveBeenCalled();
  });

  it("conserve la lecture du seul profil de l'utilisateur connecté", async () => {
    const response = await readProfile();
    expect(response.status).toBe(200);
    expect(io.findProfile).toHaveBeenCalledWith({ where: { userId: "fixture-owner" } });
    expect(io.writeProfile).not.toHaveBeenCalled();
    expect(io.deleteProfile).not.toHaveBeenCalled();
  });

  it("n'expose pas le profil à un visiteur anonyme", async () => {
    io.session.mockResolvedValue(null);
    expect((await readProfile()).status).toBe(401);
    expect(io.findProfile).not.toHaveBeenCalled();
  });
});
