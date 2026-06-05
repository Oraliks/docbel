import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { parseFormFields } from "@/lib/booking/form-fields";
import { getServerAuthSession } from "@/lib/auth-session";
import { BookingFlow } from "./booking-flow";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await prisma.bookingTenant.findFirst({
    where: { slug, active: true },
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
  searchParams: Promise<{ cp?: string }>;
}) {
  const { slug } = await params;
  const { cp } = await searchParams;

  const tenant = await prisma.bookingTenant.findFirst({
    where: { slug, active: true },
    select: {
      slug: true,
      name: true,
      brandColor: true,
      formFields: true,
      dedupeField: true,
    },
  });

  if (!tenant) notFound();

  const fields = parseFormFields(tenant.formFields);

  const s = await getServerAuthSession().catch(() => null);
  const prefill =
    s?.user
      ? { name: (s.user.name as string) ?? "", email: (s.user.email as string) ?? "" }
      : null;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Prise de rendez-vous
        </p>
        <h1 className="glass-display text-[32px] font-semibold leading-[1.05] sm:text-[40px]">
          {tenant.name}
        </h1>
      </div>
      <BookingFlow
        slug={tenant.slug}
        tenantName={tenant.name}
        brandColor={tenant.brandColor}
        fields={fields}
        dedupeField={tenant.dedupeField}
        initialCp={cp ?? null}
        prefill={prefill}
      />
    </section>
  );
}
