import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, CalendarDays, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { listAccessibleTenants } from "@/lib/booking/access";
import { CATEGORY_LABELS } from "@/lib/booking/status";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

// The tenants list API returns pendingCount; we fetch it server-side via direct DB
// access through listAccessibleTenants which returns BookingTenant[]. We augment
// with pendingCount by calling the tenants API from the page so we re-use the same
// logic. But that would need fetch to self. Instead, we do it inline here with prisma.
import { prisma } from "@/lib/prisma";

export default async function BookingIndexPage() {
  const t = await getTranslations("public.pro");
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) notFound();

  const tenants = await listAccessibleTenants(auth.user.id, auth.user.role);

  // Fetch pendingCount for all tenants in one query
  const pendingCounts = await prisma.booking.groupBy({
    by: ["tenantId"],
    where: {
      tenantId: { in: tenants.map((t) => t.id) },
      status: "pending_approval",
    },
    _count: { id: true },
  });
  const pendingMap = new Map(
    pendingCounts.map((r) => [r.tenantId, r._count.id])
  );

  const isFgtb =
    auth.user.isAdmin ||
    (auth.user.partnerOrganization?.toLowerCase().includes("fgtb") ?? false);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("bookingTitle")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("bookingSubtitle")}
        </p>
      </div>

      {isFgtb && (
        <p className="text-sm text-muted-foreground">
          <Link
            href="/partenaire/outils/fgtb-planning"
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t("bookingFgtbPlanningTool")}
          </Link>
        </p>
      )}

      {tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <CalendarDays className="size-10 text-muted-foreground mb-4" />
          <p className="font-medium">{t("bookingEmptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("bookingEmptyBody")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => {
            const pending = pendingMap.get(tenant.id) ?? 0;
            return (
              <Card key={tenant.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {tenant.name}
                    </CardTitle>
                    {pending > 0 && (
                      <Badge className="shrink-0 bg-amber-100 text-amber-800 border-0">
                        {t("bookingPendingCount", { count: pending })}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {CATEGORY_LABELS[tenant.category] ?? tenant.category}
                    {!tenant.active && (
                      <span className="ml-2 text-destructive">{t("bookingInactive")}</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex flex-col gap-2">
                  <Link
                    href={`/partenaire/booking/${tenant.id}/agenda`}
                    className={buttonVariants({ className: "w-full" })}
                  >
                    <Clock className="size-4" />
                    {t("bookingOpenAgenda")}
                  </Link>
                  <a
                    href={`/${tenant.slug}/rendez-vous`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-full",
                    })}
                  >
                    <ExternalLink className="size-4" />
                    {t("bookingViewPublicPage")}
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
