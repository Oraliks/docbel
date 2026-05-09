import { prisma } from "@/lib/prisma";

export interface PartnerStats {
  totalOrganizations: number;
  totalDomains: number;
  activeDomains: number;
  testDomains: number;
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  disabledUsers: number;
  verifiedUsers: number;
  recentSignups: number;
  recentLogins: number;
  topOrganizations: Array<{
    organizationName: string;
    userCount: number;
  }>;
  signupsByMonth: Array<{
    month: string;
    count: number;
  }>;
}

export async function getPartnerStats(): Promise<PartnerStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    domains,
    distinctOrgs,
    users,
    recentSignups,
    recentLogins,
  ] = await Promise.all([
    prisma.partnerDomain.findMany({
      select: { isActive: true, isTest: true },
    }),
    prisma.partnerDomain.findMany({
      distinct: ["organizationName"],
      select: { organizationName: true },
    }),
    prisma.user.findMany({
      where: { role: "partner" },
      select: {
        status: true,
        emailVerified: true,
        createdAt: true,
        partnerOrganization: true,
      },
    }),
    prisma.user.count({
      where: {
        role: "partner",
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.user.count({
      where: {
        role: "partner",
        lastLoginAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const pendingUsers = users.filter((u) => u.status === "pending").length;
  const disabledUsers = users.filter(
    (u) => u.status === "disabled" || u.status === "locked",
  ).length;
  const verifiedUsers = users.filter((u) => u.emailVerified).length;

  const orgUserCounts = new Map<string, number>();
  for (const u of users) {
    if (!u.partnerOrganization) continue;
    orgUserCounts.set(
      u.partnerOrganization,
      (orgUserCounts.get(u.partnerOrganization) ?? 0) + 1,
    );
  }
  const topOrganizations = Array.from(orgUserCounts.entries())
    .map(([organizationName, userCount]) => ({ organizationName, userCount }))
    .sort((a, b) => b.userCount - a.userCount)
    .slice(0, 5);

  const monthCounts = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthCounts.set(key, 0);
  }
  for (const u of users) {
    const d = new Date(u.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthCounts.has(key)) {
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }
  }
  const signupsByMonth = Array.from(monthCounts.entries()).map(
    ([month, count]) => ({ month, count }),
  );

  return {
    totalOrganizations: distinctOrgs.length,
    totalDomains: domains.length,
    activeDomains: domains.filter((d) => d.isActive).length,
    testDomains: domains.filter((d) => d.isTest).length,
    totalUsers,
    activeUsers,
    pendingUsers,
    disabledUsers,
    verifiedUsers,
    recentSignups,
    recentLogins,
    topOrganizations,
    signupsByMonth,
  };
}
