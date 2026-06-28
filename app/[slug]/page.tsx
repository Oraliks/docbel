import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { BlockProps } from "@/lib/page-builder/types";
import { buildPageJsonLd } from "@/lib/page-builder/schema-org";
// RGPD (RGPD_QUEUE §1) : la mesure d'audience (page-views) ne doit pas tourner
// avant consentement → désactivée temporairement en attendant le bandeau cookies
// (item 6). Réactiver derrière le CMP : décommenter l'import + <PageViewBeacon />.
// import { PageViewBeacon } from "@/components/page-builder/page-view-beacon";
import { RenderedPage, resolveGlobalBlocks } from "@/lib/page-builder/render-page";

export const dynamicParams = true;
export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const pages = await Promise.race([
      prisma.page.findMany({
        where: { status: "published", deletedAt: null },
        select: { slug: true },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("generateStaticParams timeout")),
          10_000,
        ),
      ),
    ]);
    return pages.map((page) => ({ slug: page.slug }));
  } catch (error) {
    console.warn(
      "generateStaticParams: DB unreachable at build time, falling back to on-demand rendering",
      error,
    );
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.page.findFirst({
    where: {
      slug,
      deletedAt: null,
      OR: [
        { status: "published" },
        { status: "scheduled", scheduledAt: { lte: new Date() } },
      ],
    },
  });

  if (!page) return {};

  const title = page.metaTitle || page.title;
  const description = page.metaDesc || undefined;
  const ogImages = page.ogImage ? [{ url: page.ogImage }] : undefined;

  const siteUrl =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  let metadataBase: URL | undefined;
  try {
    if (siteUrl) metadataBase = new URL(siteUrl);
  } catch {
    metadataBase = undefined;
  }

  return {
    title,
    description,
    ...(metadataBase ? { metadataBase } : {}),
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/${page.slug}`,
      siteName: "Docbel",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: page.ogImage ? [page.ogImage] : undefined,
    },
  };
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await prisma.page.findFirst({
    where: {
      slug,
      deletedAt: null,
      OR: [
        { status: "published" },
        { status: "scheduled", scheduledAt: { lte: new Date() } },
      ],
    },
  });

  if (!page) notFound();

  const blocks: BlockProps[] = Array.isArray(page.content)
    ? (page.content as unknown as BlockProps[])
    : [];

  // Resolve global blocks referenced by `globalRef` blocks (SSR), so the
  // GlobalBlocksProvider can hand the map to BlockRenderer.
  const globalMap = await resolveGlobalBlocks(blocks);

  const jsonLd = buildPageJsonLd(blocks, {
    title: page.title,
    metaTitle: page.metaTitle,
    metaDesc: page.metaDesc,
    ogImage: page.ogImage,
    slug: page.slug,
    updatedAt: page.updatedAt,
  });

  return (
    <>
      {/* <PageViewBeacon slug={page.slug} /> — désactivé tant que le bandeau de consentement n'est pas en place (RGPD_QUEUE §1). */}
      {jsonLd.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}

      <RenderedPage page={page} blocks={blocks} globalMap={globalMap} />
    </>
  );
}
