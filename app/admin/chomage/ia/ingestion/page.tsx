/**
 * Page admin — Veille / Ingestion (Feature 1).
 */

import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";
import { CompactIaHeader } from "@/components/admin/chomage-ia/compact-ia-header";
import { AiDisabledBanner } from "@/components/admin/chomage-ia/ai-disabled-banner";
import { IngestionWorkspace } from "@/components/admin/chomage-ia/ingestion/ingestion-workspace";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";

export const dynamic = "force-dynamic";

export default async function ChomageIaIngestionPage() {
  const [aiEnabledRaw, ingestionEnabledRaw, total, enabled, sessionsCount, promptsCount] =
    await Promise.all([
      getSetting(SETTING_KEYS.AI_HELP_ENABLED),
      getSetting(SETTING_KEYS.CHOMAGE_IA_INGESTION_ENABLED),
      prisma.knowledgeSource.count({ where: { domain: DEFAULT_DOMAIN } }),
      prisma.knowledgeSource.count({
        where: { domain: DEFAULT_DOMAIN, enabled: true },
      }),
      prisma.chatSession.count({ where: { domain: DEFAULT_DOMAIN } }),
      prisma.generatedPrompt.count({ where: { domain: DEFAULT_DOMAIN } }),
    ]);

  const aiEnabled = aiEnabledRaw === "true";
  const ingestionEnabled = ingestionEnabledRaw === "true";
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  return (
    <div className="flex flex-col">
      <CompactIaHeader
        activeTab="sources"
        stats={{
          sources: total,
          enabledSources: enabled,
          sessions: sessionsCount,
          prompts: promptsCount,
        }}
      />
      <div className="flex flex-col gap-4 px-4 py-4 lg:px-6">
        <AiDisabledBanner enabled={aiEnabled} hasKey={hasKey} />
        {!ingestionEnabled ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
            La veille automatique est désactivée (cron skip). Active{" "}
            <code className="rounded bg-amber-500/20 px-1">
              CHOMAGE_IA_INGESTION_ENABLED
            </code>{" "}
            dans les paramètres pour que le cron Vercel poll les sources.
          </div>
        ) : null}
        <IngestionWorkspace domain={DEFAULT_DOMAIN} />
      </div>
    </div>
  );
}
