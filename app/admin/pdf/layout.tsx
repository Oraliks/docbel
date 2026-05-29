/// Layout scopé au module PDF Forms (admin) — applique l'identité Geist.
/// Ne casse rien : c'est juste une classe sur un wrapper enfant.
export default function PdfAdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="font-geist">{children}</div>;
}
