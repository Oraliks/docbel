import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { parseFormFields } from "@/lib/booking/form-fields";
import { loadPublicAvailability } from "@/lib/booking/public-availability";
import { brusselsNowParts } from "@/lib/booking/dates";
import { normalizeLocale } from "@/lib/booking/i18n";
import { getServerAuthSession } from "@/lib/auth-session";
import { BookingFlow } from "./booking-flow";
import { BookingUnavailable } from "@/components/booking/booking-unavailable";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await prisma.bookingTenant.findFirst({
    where: { slug },
    select: { name: true },
  });
  if (!tenant) return {};
  return { title: `Prendre rendez-vous — ${tenant.name}` };
}

export default async function TenantBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cp?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const { cp, lang } = await searchParams;

  const tenant = await prisma.bookingTenant.findFirst({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      brandColor: true,
      formFields: true,
      dedupeField: true,
      active: true,
    },
  });

  if (!tenant) notFound();

  // Guichet désactivé (pas encore lancé / en pause) → page « bientôt disponible »
  // plutôt que le formulaire. La réservation reste impossible (APIs gardées).
  if (!tenant.active) {
    return (
      <section className="mx-auto w-full max-w-6xl">
        <BookingUnavailable variant="soon" tenantName={tenant.name} />
      </section>
    );
  }

  const fields = parseFormFields(tenant.formFields);

  const s = await getServerAuthSession().catch(() => null);
  const prefill =
    s?.user
      ? { name: (s.user.name as string) ?? "", email: (s.user.email as string) ?? "" }
      : null;

  // 1er rendu en SSR : on charge la semaine courante côté serveur (pas de flash
  // de chargement). La navigation entre semaines reste un fetch client.
  const initialFrom = brusselsNowParts().ymd;
  const initialAvailability = await loadPublicAvailability({
    tenantId: tenant.id,
    cp: cp ?? null,
    from: initialFrom,
    days: 7,
  }).catch(() => null);

  return (
    <section className="mx-auto w-full max-w-6xl">
      <BookingFlow
        slug={tenant.slug}
        tenantName={tenant.name}
        brandColor={tenant.brandColor}
        fields={fields}
        dedupeField={tenant.dedupeField}
        initialCp={cp ?? null}
        prefill={prefill}
        initialFrom={initialFrom}
        initialAvailability={initialAvailability}
        locale={normalizeLocale(lang)}
      />
    </section>
  );
}
