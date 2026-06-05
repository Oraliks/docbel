import { ManageClient } from "../../manage-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gérer mon rendez-vous — Beldoc",
};

export default async function ManagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Mon rendez-vous
        </p>
        <h1 className="glass-display text-[32px] font-semibold leading-[1.05] sm:text-[40px]">
          Gérer ma demande
        </h1>
      </div>
      <ManageClient token={token} />
    </section>
  );
}
