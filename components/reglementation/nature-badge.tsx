import { natureMeta } from "@/lib/reglementation/nature";

export function NatureTile({ nature, className = "" }: { nature: string; className?: string }) {
  const m = natureMeta(nature);
  const Icon = m.icon;
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${m.tile} ${className}`}
      aria-hidden
    >
      <Icon className="size-4.5" />
    </span>
  );
}
