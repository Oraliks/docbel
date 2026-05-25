/**
 * Page de chat IA pleine page.
 *
 * Server component minimal : charge l'état initial (toggle IA, stats KB) puis
 * délègue la totalité de l'UI au `ChatFullShell` client.
 *
 * Layout :
 *   - CompactIaHeader (1 ligne dense, 2 tabs : Sources / Chat)
 *   - Bandeau IA désactivée si nécessaire
 *   - ChatFullShell prend toute la hauteur restante
 *
 * Le shell occupe `h-[calc(100vh-var(--header-height)-X)]` avec X qui couvre
 * le header compact + le banner éventuel. On laisse flex-1 faire le job et on
 * définit une hauteur min pour ne pas s'écraser.
 */

import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";
import { CompactIaHeader } from "@/components/admin/chomage-ia/compact-ia-header";
import { AiDisabledBanner } from "@/components/admin/chomage-ia/ai-disabled-banner";
import { ChatFullShell } from "@/components/admin/chomage-ia/chat/chat-full-shell";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";

export const dynamic = "force-dynamic";

export default async function ChomageIaChatPage() {
  const [
    aiEnabledRaw,
    voiceEnabledRaw,
    webSearchEnabledRaw,
    total,
    enabled,
    sessionsCount,
    promptsCount,
  ] = await Promise.all([
    getSetting(SETTING_KEYS.AI_HELP_ENABLED),
    getSetting(SETTING_KEYS.CHOMAGE_IA_VOICE_ENABLED),
    getSetting(SETTING_KEYS.CHOMAGE_IA_WEB_SEARCH_ENABLED),
    prisma.knowledgeSource.count({ where: { domain: DEFAULT_DOMAIN } }),
    prisma.knowledgeSource.count({
      where: { domain: DEFAULT_DOMAIN, enabled: true },
    }),
    prisma.chatSession.count({ where: { domain: DEFAULT_DOMAIN } }),
    prisma.generatedPrompt.count({ where: { domain: DEFAULT_DOMAIN } }),
  ]);

  const aiEnabled = aiEnabledRaw === "true";
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  // Voice input nécessite OPENAI_API_KEY (Anthropic ne fait pas de transcription)
  // ET le toggle admin doit être ON. Les deux conditions doivent être vraies.
  const voiceAvailable =
    voiceEnabledRaw === "true" && !!process.env.OPENAI_API_KEY;
  // Web search nécessite BRAVE_SEARCH_API_KEY + toggle admin.
  const webSearchAvailable =
    webSearchEnabledRaw === "true" && !!process.env.BRAVE_SEARCH_API_KEY;

  return (
    // Pleine hauteur du viewport admin = 100vh - header app (var --header-height = 48px)
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-[480px] flex-col overflow-hidden">
      <CompactIaHeader
        activeTab="chat"
        stats={{
          sources: total,
          enabledSources: enabled,
          sessions: sessionsCount,
          prompts: promptsCount,
        }}
      />
      {!aiEnabled || !hasKey ? (
        <div className="shrink-0 px-4 py-2">
          <AiDisabledBanner enabled={aiEnabled} hasKey={hasKey} />
        </div>
      ) : null}
      <ChatFullShell
        domain={DEFAULT_DOMAIN}
        aiAvailable={aiEnabled && hasKey}
        voiceAvailable={voiceAvailable}
        webSearchAvailable={webSearchAvailable}
        enabledSourcesCount={enabled}
      />
    </div>
  );
}
