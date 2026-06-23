import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfilePage } from "@/components/user/profile-page";

export const dynamic = "force-dynamic";

export default async function ProfilRoute() {
  const t = await getTranslations("public.dossier");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect("/login?next=/profil");
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  });

  const initial = profile
    ? {
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        niss: profile.niss ?? "",
        birthDate: profile.birthDate?.toISOString().slice(0, 10) ?? "",
        birthPlace: profile.birthPlace ?? "",
        nationality: profile.nationality ?? "",
        gender: profile.gender ?? "",
        street: profile.street ?? "",
        streetNum: profile.streetNum ?? "",
        postalCode: profile.postalCode ?? "",
        city: profile.city ?? "",
        country: profile.country ?? "BE",
        phone: profile.phone ?? "",
        mobilePhone: profile.mobilePhone ?? "",
        iban: profile.iban ?? "",
        bic: profile.bic ?? "",
        maritalStatus: profile.maritalStatus ?? "",
        employer: profile.employer ?? "",
        employerBce: profile.employerBce ?? "",
        jobTitle: profile.jobTitle ?? "",
        contractType: profile.contractType ?? "",
        contractStart: profile.contractStart?.toISOString().slice(0, 10) ?? "",
      }
    : null;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          {t("profilEyebrow")}
        </p>
        <h1 className="glass-display text-[40px] font-semibold leading-[1.05] sm:text-[48px]">
          {t("profilTitle")}
        </h1>
        <p className="max-w-2xl text-[14px] text-[color:var(--glass-ink-soft)]">
          {t("profilIntro")}
        </p>
      </header>

      <div className="w-full">
        <ProfilePage
          initial={initial}
          userName={session.user.name || ""}
          userEmail={session.user.email}
        />
      </div>
    </section>
  );
}
