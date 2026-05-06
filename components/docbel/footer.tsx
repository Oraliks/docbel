"use client";

import Link from "next/link";
import { FileTextIcon, ShieldIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const FOOTER_LINKS = [
  { label: "Mentions legales", href: "#" },
  { label: "Vie privee", href: "#" },
  { label: "Accessibilite", href: "#" },
  { label: "Contact", href: "/contact" },
];

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileTextIcon />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Docbel</span>
          <span className="text-xs text-muted-foreground">
                Informations pratiques, outils et actualites.
          </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {FOOTER_LINKS.map((item) => (
              <Button
                key={item.label}
                variant="link"
                size="sm"
                nativeButton={false}
                render={<Link href={item.href} />}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>© 2026 Docbel. Portail d&apos;information et de services.</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldIcon className="size-3.5" />
            Construit avec un design system shadcn/ui.
          </span>
        </div>
      </div>
    </footer>
  );
}
