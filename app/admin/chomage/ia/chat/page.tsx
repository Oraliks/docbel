/**
 * Page de chat IA. Server component qui charge l'état initial (toggle, stats)
 * et délègue l'UI conversationnelle au ChatShell client.
 */

import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";
import { IaHeader } from "@/components/admin/chomage-ia/ia-header";
import { AiDisabledBanner } from "@/components/admin/chomage-ia/ai-disabled-banner";
import { ChatShell } from "@/components/admin/chomage-ia/chat/chat-shell";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";

export const dynamic = "force-dynamic";

export default async function ChomageIaChatPage() {
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
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      <IaHeader
        activeTab="chat"
        stats={{
          sources: total,
          enabledSources: enabled,
          sessions: sessionsCount,
          prompts: promptsCount,
        }}
      />
      <AiDisabledBanner enabled={aiEnabled} hasKey={hasKey} />
      <ChatShell
        domain={DEFAULT_DOMAIN}
        aiAvailable={aiEnabled && hasKey}
        enabledSourcesCount={enabled}
      />
    </div>
  );
}
