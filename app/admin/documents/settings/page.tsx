import { getSetting, SETTING_KEYS, getDefault } from "@/lib/app-settings";
import { DocumentsSettingsTabs } from "@/components/admin/documents/documents-settings-tabs";

export const dynamic = "force-dynamic";

export default async function DocumentsSettingsPage() {
  const [aiHelpEnabled, rgpdGeneral, emailSubject, emailBody] = await Promise.all([
    getSetting(SETTING_KEYS.AI_HELP_ENABLED),
    getSetting(SETTING_KEYS.RGPD_GENERAL),
    getSetting(SETTING_KEYS.EMAIL_SUBJECT),
    getSetting(SETTING_KEYS.EMAIL_BODY),
  ]);
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <DocumentsSettingsTabs
        aiHelpEnabled={aiHelpEnabled === "true"}
        hasAnthropicKey={hasAnthropicKey}
        rgpdGeneral={rgpdGeneral}
        rgpdDefault={getDefault(SETTING_KEYS.RGPD_GENERAL)}
        emailSubject={emailSubject}
        emailSubjectDefault={getDefault(SETTING_KEYS.EMAIL_SUBJECT)}
        emailBody={emailBody}
        emailBodyDefault={getDefault(SETTING_KEYS.EMAIL_BODY)}
      />
    </div>
  );
}
