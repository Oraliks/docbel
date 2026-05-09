import { SettingEditor } from "@/components/admin/documents/setting-editor";
import { PartnerEmailTestSender } from "@/components/admin/partner-email-test-sender";

export const dynamic = "force-dynamic";

export default function PartnerEmailSettingsPage() {
  const placeholders = [
    { token: "{{name}}", description: "Nom de la personne qui s'inscrit" },
    {
      token: "{{organizationName}}",
      description: "Nom de l'organisation saisi à l'inscription",
    },
    {
      token: "{{confirmationLink}}",
      description: "Lien de confirmation (avec token, valide 24 heures)",
    },
  ];
  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <PartnerEmailTestSender />
      <SettingEditor
        title="Email d'invitation partenaire"
        subtitle="Personnalisez le sujet et le corps de l'email envoyé après l'inscription d'un nouveau partenaire."
        backHref="/admin/partenaires"
        fields={[
          {
            key: "partner_invite_subject",
            label: "Sujet de l'email",
            description: "Une seule ligne. Variables disponibles ci-dessous.",
            type: "input",
            placeholders,
          },
          {
            key: "partner_invite_body",
            label: "Corps de l'email",
            description:
              "Texte brut. Le lien de confirmation doit obligatoirement apparaître via {{confirmationLink}}.",
            type: "textarea",
            rows: 14,
            placeholders,
          },
        ]}
      />
    </div>
  );
}
