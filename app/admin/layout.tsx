import { AdminLayoutProvider } from "@/components/admin-layout-provider"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayoutProvider>
      {children}
    </AdminLayoutProvider>
  )
}
