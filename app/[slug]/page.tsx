import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PublicRenderer } from "@/components/page-builder/public-renderer";
import { ThemeProvider } from "@/components/page-builder/theme-tokens";
import { BlockProps, ThemeTokens } from "@/lib/page-builder/types";
import { buildPageJsonLd } from "@/lib/page-builder/schema-org";

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
    where: { slug, status: "published", deletedAt: null },
  });

  if (!page) return {};

  return {
    title: page.metaTitle || page.title,
    description: page.metaDesc,
    openGraph: {
      title: page.metaTitle || page.title,
      description: page.metaDesc || undefined,
      images: page.ogImage ? [{ url: page.ogImage }] : undefined,
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
    where: { slug, status: "published", deletedAt: null },
  });

  if (!page) notFound();

  const blocks: BlockProps[] = Array.isArray(page.content)
    ? (page.content as unknown as BlockProps[])
    : [];

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
      {jsonLd.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-2 px-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
            Page
          </p>
          <h1 className="glass-display text-[40px] font-semibold leading-[1.05] sm:text-[48px]">
            {page.title}
          </h1>
          {page.metaDesc ? (
            <p className="max-w-2xl text-[14px] text-[color:var(--glass-ink-soft)]">
              {page.metaDesc}
            </p>
          ) : null}
        </header>

        <article className="glass-surface overflow-hidden p-6 sm:p-10">
          <ThemeProvider tokens={page.themeTokens as ThemeTokens | null}>
            <PublicRenderer
              blocks={blocks}
              context={{
                site: { name: "Docbel" },
                page: {
                  title: page.title,
                  slug: page.slug,
                  description: page.metaDesc ?? undefined,
                },
              }}
            />
          </ThemeProvider>
        </article>
      </section>
    </>
  );
}
