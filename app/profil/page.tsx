import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfilePage } from "@/components/user/profile-page";

export const dynamic = "force-dynamic";

export default async function ProfilRoute() {
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
    <div className="container max-w-4xl mx-auto py-6 px-4">
      <ProfilePage initial={initial} userName={session.user.name || ""} userEmail={session.user.email} />
    </div>
  );
}
