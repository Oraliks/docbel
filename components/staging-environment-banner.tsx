import { getTranslations } from "next-intl/server";
import { isStagingEnvironment } from "@/lib/config/runtime-environment";

export async function StagingEnvironmentBanner() {
  if (!isStagingEnvironment()) return null;

  const t = await getTranslations("public.staging");
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_BUILD_ID ??
    process.env.BUILD_ID ??
    "";
  const version = /^[a-f\d]{7,40}$/i.test(commit) ? commit.slice(0, 12) : "unknown";

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] w-full border-b border-amber-600/40 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950"
    >
      {t("banner", { version })}
    </div>
  );
}
