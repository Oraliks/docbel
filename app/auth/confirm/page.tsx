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
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-10 text-center">
      <ConfirmAccount token={token} />
    </div>
  );
}
