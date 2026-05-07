import { SettingEditor } from "@/components/admin/documents/setting-editor";

export const dynamic = "force-dynamic";

export default function EmailSettingsPage() {
  const placeholders = [
    { token: "{{filename}}", description: "Nom du fichier généré" },
    { token: "{{expiresAt}}", description: "Date d'expiration du document" },
    { token: "{{templateName}}", description: "Nom du modèle (ex: Demande C4)" },
  ];
  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <SettingEditor
        title="Email d'envoi du document"
        subtitle="Personnalisez le sujet et le corps de l'email envoyé à l'utilisateur lorsqu'il demande à recevoir son document par email."
        backHref="/admin/documents"
        fields={[
          {
            key: "email_subject",
            label: "Sujet de l'email",
            description: "Une seule ligne. Vous pouvez utiliser des variables.",
            type: "input",
            placeholders,
          },
          {
            key: "email_body",
            label: "Corps de l'email",
            description:
              "Texte brut. Le PDF/DOCX sera attaché en pièce jointe automatiquement.",
            type: "textarea",
            rows: 12,
            placeholders,
          },
        ]}
      />
    </div>
  );
}
