/// Layout scopé au module PDF Forms (front public) — applique l'identité Geist.
export default function PdfPublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="font-geist">{children}</div>;
}
