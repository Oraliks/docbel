import type { Metadata } from "next";
import { ConfirmAccount } from "@/components/docbel/confirm-account";

export const metadata: Metadata = {
  title: "Confirmation de compte | DocBel",
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ConfirmAccountRoute({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = params.token ?? null;

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col items-center py-12">
      <ConfirmAccount token={token} />
    </section>
  );
}
