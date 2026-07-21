import { getTranslations } from "next-intl/server";
import {
  KeyRoundIcon,
  ShieldCheckIcon,
  TimerIcon,
  UserXIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PRIVACY_POINTS: { Icon: LucideIcon; key: string }[] = [
  { Icon: UserXIcon, key: "trustPoint1" },
  { Icon: KeyRoundIcon, key: "trustPoint2" },
  { Icon: TimerIcon, key: "trustPoint3" },
];

export async function TrustBand() {
  const t = await getTranslations("public.home");

  return (
    <Card
      aria-label={t("trustHeading")}
      className="relative min-h-[172px] overflow-hidden rounded-[24px] py-5 sm:py-6"
    >
      <div
        aria-hidden
        data-a11y-secondary="true"
        className="pointer-events-none absolute right-[-44px] top-1/2 hidden size-56 -translate-y-1/2 rounded-full bg-primary/10 blur-2xl lg:block"
      />
      <div className="relative z-10 lg:pr-44">
        <CardHeader className="px-5 sm:px-7">
          <CardTitle className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheckIcon aria-hidden />
            </span>
            <h2 className="glass-display text-[23px] font-semibold leading-tight sm:text-[27px]">
              {t("trustHeading")}
            </h2>
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 px-5 sm:px-7 md:grid-cols-3">
          {PRIVACY_POINTS.map(({ Icon, key }) => (
            <div key={key} className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon aria-hidden />
              </span>
              <p className="text-[11px] leading-relaxed text-[color:var(--glass-ink-soft)] sm:text-xs">
                {t.rich(key as Parameters<typeof t.rich>[0], {
                  strong: (chunks) => (
                    <strong className="font-bold text-[color:var(--glass-ink)]">
                      {chunks}
                    </strong>
                  ),
                })}
              </p>
            </div>
          ))}
        </CardContent>
      </div>

      <div
        aria-hidden
        data-a11y-secondary="true"
        className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 lg:block"
      >
        <div className="relative flex size-28 items-center justify-center rounded-[32px] border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] text-primary shadow-[0_22px_50px_rgba(91,70,229,0.22)] rotate-3">
          <ShieldCheckIcon className="size-14" strokeWidth={1.6} aria-hidden />
          <span className="absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full bg-[color:var(--glass-pop-fg)] text-primary-foreground shadow-lg">
            <ShieldCheckIcon className="size-4" aria-hidden />
          </span>
        </div>
      </div>
    </Card>
  );
}
