export class OpenAIImageError extends Error {
  kind: "config" | "rate" | "upstream" | "invalid";

  constructor(message: string, kind: "config" | "rate" | "upstream" | "invalid") {
    super(message);
    this.name = "OpenAIImageError";
    this.kind = kind;
  }
}

export interface GenerateImageOptions {
  prompt: string;
  referenceImage?: { buffer: Buffer; mimeType: string } | null;
  size?: string;
}

export async function generateImage(opts: GenerateImageOptions): Promise<Buffer> {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    throw new OpenAIImageError("Configuration du service d'image manquante.", "config");
  }

  const size = opts.size || "1536x1024";

  let res: Response;

  if (opts.referenceImage) {
    // Multipart edits endpoint — let fetch set the multipart boundary automatically
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", opts.prompt);
    form.append("size", size);
    form.append("n", "1");
    form.append(
      "image",
      new Blob([new Uint8Array(opts.referenceImage.buffer)], { type: opts.referenceImage.mimeType }),
      "reference.png"
    );

    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, prompt: opts.prompt, size, n: 1 }),
    });
  }

  if (!res.ok) {
    console.error("[openai-image] HTTP", res.status);
    throw new OpenAIImageError(
      "La génération d'image a échoué.",
      res.status === 429 ? "rate" : res.status >= 500 ? "upstream" : "invalid"
    );
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json?.data?.[0]?.b64_json;

  if (!b64) {
    throw new OpenAIImageError("Réponse du service d'image vide.", "upstream");
  }

  return Buffer.from(b64, "base64");
}
