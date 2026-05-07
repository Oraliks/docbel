import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HomeIcon } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center text-foreground">
      <div className="flex items-baseline gap-3">
        <span className="text-7xl font-bold tracking-tight text-primary">404</span>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Page introuvable</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Cette page n&apos;existe pas ou a été déplacée. Vérifiez l&apos;URL ou retournez à
          l&apos;accueil.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/" />}>
        <HomeIcon data-icon="inline-start" />
        Retour à l&apos;accueil
      </Button>
    </div>
  );
}
