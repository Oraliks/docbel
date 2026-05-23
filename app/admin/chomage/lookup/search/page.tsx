import { redirect } from "next/navigation";

/// Page fusionnée dans /admin/chomage/lookup (tab Recherche).
export default async function LookupSearchRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const sp = await searchParams;
  const usp = new URLSearchParams({ tab: "search" });
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") usp.set(k, v);
  }
  redirect(`/admin/chomage/lookup?${usp.toString()}`);
}
