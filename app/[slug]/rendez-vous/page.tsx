import { notFound, redirect } from "next/navigation";
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

// Anciens slugs de tenants renommés — évite de casser les liens déjà partagés.
// CGSLB → SYNOVA (renommage officiel du syndicat, 05/2026).
const LEGACY_SLUGS: Record<string, string> = { cgslb: "synova" };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (LEGACY_SLUGS[slug]) redirect(`/${LEGACY_SLUGS[slug]}/rendez-vous`);
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

  if (LEGACY_SLUGS[slug]) {
    const qs = new URLSearchParams();
    if (cp) qs.set("cp", cp);
    if (lang) qs.set("lang", lang);
    const suffix = qs.toString();
    redirect(`/${LEGACY_SLUGS[slug]}/rendez-vous${suffix ? `?${suffix}` : ""}`);
  }

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
      <section className="w-full">
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
