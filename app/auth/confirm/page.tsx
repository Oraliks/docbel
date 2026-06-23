import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConfirmAccount } from "@/components/docbel/confirm-account";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.auth");
  return {
    title: t("confirmMetaTitle"),
  };
}

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
