/**
 * Page admin — Gaps de connaissance (Feature 6).
 */

import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";
import { CompactIaHeader } from "@/components/admin/chomage-ia/compact-ia-header";
import { AiDisabledBanner } from "@/components/admin/chomage-ia/ai-disabled-banner";
import { GapsWorkspace } from "@/components/admin/chomage-ia/gaps/gaps-workspace";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";

export const dynamic = "force-dynamic";

export default async function ChomageIaGapsPage() {
  const [aiEnabledRaw, total, enabled, sessionsCount, promptsCount] =
    await Promise.all([
      getSetting(SETTING_KEYS.AI_HELP_ENABLED),
      prisma.knowledgeSource.count({ where: { domain: DEFAULT_DOMAIN } }),
      prisma.knowledgeSource.count({
        where: { domain: DEFAULT_DOMAIN, enabled: true },
      }),
      prisma.chatSession.count({ where: { domain: DEFAULT_DOMAIN } }),
      prisma.generatedPrompt.count({ where: { domain: DEFAULT_DOMAIN } }),
    ]);

  const aiEnabled = aiEnabledRaw === "true";
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
        <GapsWorkspace domain={DEFAULT_DOMAIN} />
      </div>
    </div>
  );
}
