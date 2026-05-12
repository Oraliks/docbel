"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftIcon, WrenchIcon } from "lucide-react";
import { ToolPage } from "@/components/docbel/tool-page";
import { Tool } from "@/lib/docbel-data";

interface LegacyToolViewProps {
  tool: Tool | null;
}

export function LegacyToolView({ tool }: LegacyToolViewProps) {
  const router = useRouter();

  if (!tool) {
    return (
      <section className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition-colors outline-none hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
        >
          <ArrowLeftIcon className="size-4" />
          Retour à l&apos;accueil
        </button>

        <div className="glass-surface flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span
            className="flex size-14 items-center justify-center rounded-2xl text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
            }}
          >
            <WrenchIcon className="size-6" />
          </span>
          <h1 className="glass-display text-[24px] font-semibold">
            Outil introuvable
          </h1>
          <p className="max-w-md text-[13px] text-[color:var(--glass-ink-soft)]">
            L&apos;outil demandé n&apos;est pas disponible dans le catalogue
            public. Il a peut-être été renommé ou retiré.
          </p>
        </div>
      </section>
    );
  }

  return (
    <ToolPage
      tool={tool}
      accent="#7C3AED"
      onBack={() => router.back()}
      lang="FR"
    />
  );
}
