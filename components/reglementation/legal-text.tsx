import { parseLegalText } from "@/lib/reglementation/parse-legal-text";

export function LegalText({ raw }: { raw: string }) {
  const blocks = parseLegalText(raw);

  if (blocks.length === 0) {
    return <p className="text-muted-foreground">{/* rien à afficher */}</p>;
  }

  return (
    <div className="max-w-[72ch] space-y-3 text-[15px] leading-relaxed">
      {blocks.map((block, i) => {
        if (block.type === "section") {
          return (
            <p key={i}>
              <strong>{block.marker}.</strong> {block.text}
            </p>
          );
        }
        if (block.type === "list-item") {
          return (
            <div key={i} className="flex gap-2 pl-4">
              <span className="text-muted-foreground">{block.marker}</span>
              <span>{block.text}</span>
            </div>
          );
        }
        if (block.type === "abroge") {
          return (
            <p
              key={i}
              className="rounded-md bg-muted px-3 py-2 text-sm italic text-muted-foreground"
            >
              {block.text}
            </p>
          );
        }
        // paragraph (default)
        return <p key={i}>{block.text}</p>;
      })}
    </div>
  );
}
