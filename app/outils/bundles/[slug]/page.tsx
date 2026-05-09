import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BundleRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const bundle = await prisma.documentBundle.findUnique({
    where: { slug },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: {
          template: {
            include: {
              tool: { select: { id: true, name: true, slug: true, description: true } },
              organisme: { select: { shortName: true, name: true, color: true } },
            },
          },
        },
      },
    },
  });

  if (!bundle || !bundle.active) {
    notFound();
  }

  const totalSteps = bundle.items.length;

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center text-white"
            style={{ backgroundColor: bundle.color }}
          >
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{bundle.name}</h1>
            <p className="text-sm text-muted-foreground">
              {totalSteps} document{totalSteps !== 1 ? "s" : ""} à compléter
            </p>
          </div>
        </div>
        {bundle.description && (
          <p className="text-sm text-muted-foreground">{bundle.description}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents du parcours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bundle.items.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 border rounded-md hover:bg-muted/40 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-medium text-sm flex-shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{item.template.tool.name}</span>
                  {item.template.organisme && (
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: item.template.organisme.color,
                        color: item.template.organisme.color,
                      }}
                    >
                      {item.template.organisme.shortName}
                    </Badge>
                  )}
                  {!item.required && (
                    <Badge variant="secondary" className="text-xs">
                      Optionnel
                    </Badge>
                  )}
                </div>
                {item.template.tool.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {item.template.tool.description}
                  </p>
                )}
              </div>
              <Button
                render={<Link href={`/outils/${item.template.tool.slug}`} />}
                size="sm"
                variant="outline"
              >
                <FileText className="w-4 h-4 mr-1" />
                Compléter
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted-foreground">
            Vous pouvez compléter les documents dans n&apos;importe quel ordre. Vos données saisies
            sont sauvegardées automatiquement si vous êtes connecté.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
