import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** Every public signup entry uses the same factual V1 closed state. */
export default async function RegistrationLayout() {
  const d = await getTranslations("public.design");
  const chrome = await getTranslations("public.chrome");
  return (
    <section className="flex min-h-[60svh] w-full items-center justify-center p-6">
      <div className="flex w-full flex-col gap-5 rounded-3xl border bg-card p-6 text-card-foreground sm:p-8">
        <h1 className="text-3xl font-semibold leading-tight">{d("registrationClosedTitle")}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">{d("registrationClosedBody")}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/outils" className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">{chrome("navTools")}</Link>
          <Link href="/login" className="inline-flex min-h-12 items-center rounded-xl border px-5 font-semibold">{d("privateAccess")}</Link>
        </div>
      </div>
    </section>
  );
}
