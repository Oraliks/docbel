import Image from "next/image";

type DocBelLogoProps = {
  variant?: "horizontal" | "symbol";
  className?: string;
  decorative?: boolean;
  tone?: "auto" | "light" | "dark";
};

const LOGOS = {
  horizontal: {
    light: { src: "/brand/docbel-noeud-guide-horizontal.svg", width: 959, height: 240 },
    dark: { src: "/brand/docbel-noeud-guide-horizontal-sombre.svg", width: 959, height: 240 },
  },
  symbol: {
    light: { src: "/brand/docbel-noeud-guide-symbole.svg", width: 544, height: 384 },
    dark: { src: "/brand/docbel-noeud-guide-symbole-sombre.svg", width: 544, height: 384 },
  },
} as const;

export function DocBelLogo({
  variant = "horizontal",
  className,
  decorative = false,
  tone = "auto",
}: DocBelLogoProps) {
  const logos = LOGOS[variant];

  return (
    <span
      className={`inline-flex shrink-0 items-center ${className ?? ""}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "DocBel"}
      aria-hidden={decorative ? true : undefined}
    >
      {tone === "light" || tone === "dark" ? (
        <Image
          src={logos[tone].src}
          width={logos[tone].width}
          height={logos[tone].height}
          alt=""
          aria-hidden="true"
          unoptimized
          className="block h-full w-auto max-w-full"
        />
      ) : (
        <>
          <Image
            src={logos.light.src}
            width={logos.light.width}
            height={logos.light.height}
            alt=""
            aria-hidden="true"
            unoptimized
            className="block h-full w-auto max-w-full dark:hidden"
          />
          <Image
            src={logos.dark.src}
            width={logos.dark.width}
            height={logos.dark.height}
            alt=""
            aria-hidden="true"
            unoptimized
            className="hidden h-full w-auto max-w-full dark:block"
          />
        </>
      )}
    </span>
  );
}
