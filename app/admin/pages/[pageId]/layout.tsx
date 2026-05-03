import { TooltipProvider } from "@/components/ui/tooltip"

export default function PageBuilderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TooltipProvider>
      {children}
    </TooltipProvider>
  )
}
