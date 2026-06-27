import { I18nTabs } from "@/components/admin/i18n/i18n-tabs";

/// Onglets de section i18n (Traductions / Glossaire / Corrections) partagés
/// par toutes les sous-pages. L'auth admin est appliquée par app/admin/layout.tsx.
export default function I18nLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <I18nTabs />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
