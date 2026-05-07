"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftIcon, WrenchIcon } from "lucide-react";
import { ToolPage } from "@/components/docbel/tool-page";
import { Tool } from "@/lib/docbel-data";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface LegacyToolViewProps {
  tool: Tool | null;
}

export function LegacyToolView({ tool }: LegacyToolViewProps) {
  const router = useRouter();

  if (!tool) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WrenchIcon />
          </EmptyMedia>
          <EmptyTitle>Outil non trouvé</EmptyTitle>
          <EmptyDescription>
            L&apos;outil demandé n&apos;est pas disponible dans le catalogue public.
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={() => router.push("/")}>
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          Retour à l&apos;accueil
        </Button>
      </Empty>
    );
  }

  return <ToolPage tool={tool} accent="#C8102E" onBack={() => router.back()} lang="FR" />;
}
