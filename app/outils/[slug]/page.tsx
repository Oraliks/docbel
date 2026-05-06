"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, WrenchIcon } from "lucide-react";
import { ToolPage } from "@/components/docbel/tool-page";
import { getToolBySlug } from "@/lib/docbel-data";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function ToolRoute() {
  const router = useRouter();
  const params = useParams();
  const tool = getToolBySlug(params.slug as string);

  if (!tool) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WrenchIcon />
          </EmptyMedia>
          <EmptyTitle>Outil non trouve</EmptyTitle>
          <EmptyDescription>
            L&apos;outil demande n&apos;est pas disponible dans le catalogue public.
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={() => router.push("/")}>
          <ArrowLeftIcon data-icon="inline-start" />
          Retour a l&apos;accueil
        </Button>
      </Empty>
    );
  }

  return <ToolPage tool={tool} accent="#C8102E" onBack={() => router.back()} lang="FR" />;
}
