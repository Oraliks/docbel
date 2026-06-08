import { getTranslations } from "next-intl/server";
import { SettingEditor } from "@/components/admin/documents/setting-editor";
import { PartnerEmailTestSender } from "@/components/admin/partner-email-test-sender";

export const dynamic = "force-dynamic";

export default async function EmployerEmailSettingsPage() {
  const t = await getTranslations("admin.employeurs");
  const placeholders = [
    { token: "{{name}}", description: t("placeholderTokenName") },
    {
      token: "{{organizationName}}",
      description: t("placeholderTokenOrganizationName"),
    },
    {
      token: "{{confirmationLink}}",
      description: t("placeholderTokenConfirmationLink"),
    },
  ];
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <PartnerEmailTestSender segment="employeur" />
      <SettingEditor
        title={t("emailInviteTitle")}
        subtitle={t("emailInviteSubtitle")}
        backHref="/admin/employeurs"
        fields={[
          {
            key: "employer_invite_subject",
            label: t("emailSubjectLabel"),
            description: t("emailSubjectDescription"),
            type: "input",
            placeholders,
          },
          {
            key: "employer_invite_body",
            label: t("emailBodyLabel"),
            description: t("emailBodyDescription"),
            type: "textarea",
            rows: 14,
            placeholders,
          },
        ]}
      />
    </div>
  );
}
