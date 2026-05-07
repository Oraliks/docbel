import { SettingEditor } from "@/components/admin/documents/setting-editor";

export const dynamic = "force-dynamic";

export default function RgpdSettingsPage() {
  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <SettingEditor
        title="Conditions générales (RGPD)"
        subtitle="Texte affiché dans la modale lorsqu'un utilisateur clique sur « les conditions » avant de cocher la case de consentement."
        backHref="/admin/documents"
        fields={[
          {
            key: "rgpd_general",
            label: "Texte des conditions générales",
            description:
              "Ce texte s'affiche dans une modale quand l'utilisateur clique sur le lien dans la case à cocher du formulaire.",
            type: "textarea",
            rows: 20,
          },
        ]}
      />
    </div>
  );
}
