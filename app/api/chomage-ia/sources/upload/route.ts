/**
 * POST /api/chomage-ia/sources/upload
 *
 * Upload d'un fichier qui devient une KnowledgeSource. Single-file par requête —
 * le frontend boucle sur les fichiers pour les uploader séquentiellement.
 *
 *  1. On crée un File (réutilise public/uploads/ via lib/file-storage).
 *  2. Extraction texte selon le MIME :
 *       - application/pdf                                    → pdfjs-dist
 *       - application/vnd.openxmlformats…wordprocessingml…   → mammoth
 *       - application/vnd.openxmlformats…spreadsheetml…      → xlsx (TSV par feuille)
 *       - application/vnd.openxmlformats…presentationml…     → adm-zip + regex sur <a:t>
 *       - image/*                                            → caption manuel obligatoire
 *     Si l'extraction échoue (< 50 caractères), on tombe en fallback "édition manuelle".
 *  3. On crée la KnowledgeSource liée au File.
 *
 * FormData attendu :
 *   file        : Blob (obligatoire)
 *   title       : string (obligatoire)
 *   kind        : "pdf" | "image_caption" | "docx" | "xlsx" | "pptx" (optionnel — détecté via MIME si absent)
 *   content     : string (obligatoire pour image_caption ; optionnel sinon)
 *   tags        : string JSON array (optionnel)
 *   sourceUrl   : string (optionnel)
 *   domain      : string (optionnel, défaut "chomage")
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { buildStoredFilePath, getUploadDirectory } from "@/lib/file-storage";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Mapping MIME → kind canonique (priorité sur le `kind` envoyé par le client).
const MIME_TO_KIND: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "image_caption",
  "image/png": "image_caption",
  "image/webp": "image_caption",
  "image/gif": "image_caption",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
};

const ALLOWED_KINDS = new Set([
  "pdf",
  "image_caption",
  "docx",
  "xlsx",
  "pptx",
]);

// fileType DB (libre) : sert au filtrage côté file manager.
const KIND_TO_FILE_TYPE: Record<string, string> = {
  pdf: "pdf",
  image_caption: "image",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

/**
 * Détecte le kind à partir du MIME en priorité, puis fallback sur l'extension.
 */
function inferKind(file: File, declaredKind: string): string {
  const fromMime = MIME_TO_KIND[file.type];
  if (fromMime) return fromMime;
  if (declaredKind && ALLOWED_KINDS.has(declaredKind)) return declaredKind;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (ext === "pptx") return "pptx";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image_caption";
  return "";
}

/**
 * PDF → 2 stratégies en cascade :
 *   1. pdfjs-dist (legacy build, sans worker) — précis sur les PDF natifs.
 *   2. pdf-parse en fallback — plus tolérant sur les PDF complexes ou les
 *      environnements serverless où pdfjs-dist peut planter silencieusement.
 *
 * Loggue chaque étape (pages traitées, chars extraits, erreur) pour qu'on
 * sache exactement pourquoi un PDF n'est pas extrait quand ça arrive
 * (cf. console serveur).
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  let viaPdfjs = "";
  let pdfjsPages = 0;
  let pdfjsErr: unknown = null;

  // 1. Tentative pdfjs-dist
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const uint8 = new Uint8Array(buffer);
    const doc = await pdfjs.getDocument({ data: uint8 }).promise;
    const pages: string[] = [];
    const maxPages = Math.min(doc.numPages, 80);
    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((it: { str?: string }) => it.str ?? "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (pageText.length > 0) pages.push(pageText);
      } catch {
        // skip page on error
      }
    }
    pdfjsPages = pages.length;
    viaPdfjs = pages.join("\n\n").trim().slice(0, 180_000);
    console.log(
      `[chomage-ia upload] pdfjs: ${doc.numPages} pages totales, ${pdfjsPages} avec texte, ${viaPdfjs.length} chars extraits`
    );
  } catch (err) {
    pdfjsErr = err;
    console.error("[chomage-ia upload] pdfjs failed:", err);
  }

  // Si pdfjs a réussi à extraire suffisamment, on retourne directement.
  if (viaPdfjs.length >= 50) return viaPdfjs;

  // 2. Fallback pdf-parse v2 (classe PDFParse, API moderne).
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    // result.text concatène toutes les pages. Si null/vide, on essaie pages[].text.
    const raw =
      result.text ??
      (result.pages ?? [])
        .map((p) => p.text ?? "")
        .filter(Boolean)
        .join("\n\n");
    const text = (raw ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 180_000);
    console.log(
      `[chomage-ia upload] pdf-parse: ${result.total ?? "?"} pages, ${text.length} chars extraits`
    );
    if (text.length > viaPdfjs.length) return text;
  } catch (err) {
    console.error("[chomage-ia upload] pdf-parse failed:", err);
  }

  // 3. Fallback ultime : PDF probablement scanné → rasterise chaque page
  //    en PNG et applique Tesseract OCR. Capé à PDF_OCR_MAX_PAGES.
  console.log(
    `[chomage-ia upload] PDF natif vide (pdfjs=${viaPdfjs.length} chars) — tentative OCR scanné…`
  );
  const viaOcr = await ocrPdfScanned(buffer);
  if (viaOcr.length >= 50) return viaOcr;

  // Vraiment rien à extraire — on retourne le best effort (probablement vide).
  console.warn(
    "[chomage-ia upload] PDF illisible même après OCR. Fichier peut-être corrompu, protégé ou avec une mauvaise qualité de scan."
  );
  return viaPdfjs.length > viaOcr.length ? viaPdfjs : viaOcr;
}

/**
 * DOCX → mammoth (texte brut, on perd la mise en forme mais on garde la
 * structure paragraphes).
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value.replace(/\r\n?/g, "\n").trim().slice(0, 180_000);
  } catch (err) {
    console.error("DOCX extract error:", err);
    return "";
  }
}

/**
 * XLSX → xlsx lib. Pour chaque feuille on rend un bloc TSV précédé du nom.
 * Format dégradé volontairement texte-friendly pour que l'IA puisse le lire.
 */
async function extractXlsxText(buffer: Buffer): Promise<string> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const blocks: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: false,
      });
      if (rows.length === 0) continue;
      // Cap raisonnable : 500 lignes par feuille, 50 col max.
      const capped = rows.slice(0, 500).map((r) =>
        r.slice(0, 50).map((c) => String(c ?? "").replace(/\t|\n|\r/g, " ").trim())
      );
      const tsv = capped.map((r) => r.join("\t")).join("\n");
      blocks.push(`### Feuille: ${sheetName}\n${tsv}`);
    }
    return blocks.join("\n\n").trim().slice(0, 180_000);
  } catch (err) {
    console.error("XLSX extract error:", err);
    return "";
  }
}

/**
 * PPTX → adm-zip + regex sur `<a:t>` (texte des runs).
 * Un .pptx est un ZIP avec une slide par fichier `ppt/slides/slide{N}.xml`.
 * On ne dépend pas d'une lib dédiée (pas de support natif dans le projet).
 */
async function extractPptxText(buffer: Buffer): Promise<string> {
  try {
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    // Trie les slides par numéro pour préserver l'ordre.
    const slideEntries = entries
      .filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e.entryName))
      .sort((a, b) => {
        const na = parseInt(a.entryName.match(/slide(\d+)\.xml$/i)?.[1] ?? "0", 10);
        const nb = parseInt(b.entryName.match(/slide(\d+)\.xml$/i)?.[1] ?? "0", 10);
        return na - nb;
      });
    if (slideEntries.length === 0) return "";

    const slides: string[] = [];
    for (let i = 0; i < slideEntries.length; i++) {
      const xml = slideEntries[i].getData().toString("utf8");
      // Récupère tout ce qu'il y a entre <a:t> et </a:t> (avec ou sans attributs).
      const matches: string[] = [];
      const re = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null) {
        const txt = decodeXmlEntities(m[1]).trim();
        if (txt.length > 0) matches.push(txt);
      }
      if (matches.length > 0) {
        slides.push(`### Slide ${i + 1}\n${matches.join("\n")}`);
      }
    }
    return slides.join("\n\n").trim().slice(0, 180_000);
  } catch (err) {
    console.error("PPTX extract error:", err);
    return "";
  }
}

/**
 * Cap de pages OCR pour un PDF scanné — chaque page coûte ~5-10s sur
 * un CPU moyen. 20 pages ≈ 2 min max, raisonnable côté UX.
 */
const PDF_OCR_MAX_PAGES = 20;

/**
 * Lazy-init d'un worker Tesseract trilingue (fr/nl/en). Réutilisable
 * pour plusieurs `recognize()` consécutifs — beaucoup plus rapide que
 * de recréer un worker par image (le premier appel charge ~30 Mo de
 * modèles, les suivants utilisent le cache).
 */
async function getTesseractWorker() {
  const { createWorker } = await import("tesseract.js");
  return createWorker(["fra", "nld", "eng"]);
}

/**
 * IMAGE → OCR via Tesseract.js (worker NodeJS, fr+nl+en).
 */
async function ocrImage(buffer: Buffer): Promise<string> {
  let worker: Awaited<ReturnType<typeof getTesseractWorker>> | null = null;
  try {
    worker = await getTesseractWorker();
    const { data } = await worker.recognize(buffer);
    const text = (data.text ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 180_000);
    console.log(
      `[chomage-ia upload] tesseract OCR: ${text.length} chars (confidence avg=${Math.round(
        data.confidence ?? 0
      )}%)`
    );
    return text;
  } catch (err) {
    console.error("[chomage-ia upload] OCR failed:", err);
    return "";
  } finally {
    if (worker) await worker.terminate();
  }
}

/**
 * PDF scanné → rasterise chaque page en PNG via pdf-to-img (pdfjs + sharp
 * en interne, fonctionne en serverless), puis applique Tesseract OCR sur
 * chaque image. Concatène avec un header "### Page N".
 *
 * Capé à PDF_OCR_MAX_PAGES pour éviter timeout serverless (~2 min max).
 */
async function ocrPdfScanned(buffer: Buffer): Promise<string> {
  let worker: Awaited<ReturnType<typeof getTesseractWorker>> | null = null;
  try {
    // pdf-to-img exporte une factory async-iterable de buffers PNG.
    // Scale 2 = bonne qualité OCR sans exploser la mémoire (1× = trop flou,
    // 3× = très lent et lourd).
    const { pdf } = await import("pdf-to-img");
    const document = await pdf(buffer, { scale: 2 });

    // Worker Tesseract réutilisé pour TOUTES les pages — gain perf majeur.
    worker = await getTesseractWorker();

    const pages: string[] = [];
    let pageNum = 0;
    let totalChars = 0;
    let totalConfidence = 0;
    let pagesWithText = 0;

    for await (const imageBuf of document) {
      pageNum++;
      if (pageNum > PDF_OCR_MAX_PAGES) {
        pages.push(
          `\n\n(OCR interrompu après ${PDF_OCR_MAX_PAGES} pages — re-uploade la suite séparément si besoin.)`
        );
        break;
      }
      try {
        const { data } = await worker.recognize(imageBuf);
        const text = (data.text ?? "")
          .replace(/\r\n?/g, "\n")
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        if (text.length > 0) {
          pages.push(`### Page ${pageNum}\n${text}`);
          totalChars += text.length;
          totalConfidence += data.confidence ?? 0;
          pagesWithText++;
        }
      } catch (err) {
        console.error(`[chomage-ia upload] OCR page ${pageNum} failed:`, err);
      }
    }

    const avgConfidence =
      pagesWithText > 0 ? Math.round(totalConfidence / pagesWithText) : 0;
    console.log(
      `[chomage-ia upload] PDF OCR: ${pagesWithText}/${pageNum} pages OK, ${totalChars} chars (confidence avg=${avgConfidence}%)`
    );
    return pages.join("\n\n").trim().slice(0, 180_000);
  } catch (err) {
    console.error("[chomage-ia upload] PDF rasterize/OCR failed:", err);
    return "";
  } finally {
    if (worker) await worker.terminate();
  }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

export async function POST(req: NextRequest) {
  try {
    return await handleUpload(req);
  } catch (err) {
    // Catch global : une exception non-catchée (Prisma, fs, parser) sortait
    // en 500 sans message côté client. Ici on logue le stack côté serveur et
    // on renvoie le message en JSON pour debug — le frontend l'affichera
    // dans le toast d'erreur.
    console.error("[chomage-ia upload] uncaught error:", err);
    const message =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return NextResponse.json(
      {
        error: "Erreur serveur lors de l'upload",
        detail: message,
      },
      { status: 500 }
    );
  }
}

async function handleUpload(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const declaredKind = (formData.get("kind") as string | null) ?? "";
  const content = (formData.get("content") as string | null)?.trim() ?? "";
  const sourceUrl = (formData.get("sourceUrl") as string | null)?.trim() ?? "";
  const domain = (formData.get("domain") as string | null) ?? DEFAULT_DOMAIN;
  const tagsRaw = formData.get("tags") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }
  if (!title || title.length < 2) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024} Mo)` },
      { status: 413 }
    );
  }

  // Détecte kind via MIME (autoritaire) → fallback declaredKind → fallback extension.
  const kind = inferKind(file, declaredKind);
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json(
      {
        error:
          "Type non supporté. Formats acceptés : PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), images (JPG/PNG/WebP/GIF).",
      },
      { status: 415 }
    );
  }

  // Validation image_caption déplacée après tentative OCR (cf. plus bas) :
  // on n'exige plus une description manuelle si Tesseract peut faire le job.

  let tags: string[] = [];
  if (tagsRaw) {
    try {
      const parsed = JSON.parse(tagsRaw);
      if (
        Array.isArray(parsed) &&
        parsed.every((t) => typeof t === "string" && t.length <= 50)
      ) {
        tags = parsed.slice(0, 20);
      }
    } catch {
      // ignore: tags invalides → vide
    }
  }

  const arrayBuf = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  // Stockage en private/uploads — best-effort. En environnement serverless
  // (Netlify Functions / Vercel / Lambda), `/var/task` est read-only et seul
  // `/tmp` est writable mais éphémère. Pour le chat IA, ce qui compte est le
  // TEXTE extrait, pas le binaire — donc on accepte de skip la persistance
  // si le FS est read-only et on continue avec juste le texte. Une note dans
  // le content informe l'admin que le binaire n'a pas été conservé.
  const { relativeDir, absoluteDir } = getUploadDirectory(true);
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const uniqueName = `${nanoid(12)}-${sanitizeFileName(file.name)}`;
  const filePath = buildStoredFilePath(relativeDir, uniqueName);
  const fullPath = join(absoluteDir, uniqueName);

  let dbFile: { id: string } | null = null;
  let fileWriteWarning: string | null = null;

  try {
    if (!existsSync(absoluteDir)) {
      await mkdir(absoluteDir, { recursive: true });
    }
    await writeFile(fullPath, buffer);

    const fileType = KIND_TO_FILE_TYPE[kind] ?? "file";
    dbFile = await prisma.file.create({
      data: {
        name: file.name,
        type: "file",
        fileType,
        mimeType: file.type || null,
        size: buffer.byteLength,
        sha256,
        parentId: null,
        isPrivate: true,
        filePath,
        createdBy: auth.user.id,
      },
    });
  } catch (err) {
    // EROFS / EACCES = filesystem read-only (serverless) → on tolère et on
    // continue sans persister le binaire. L'erreur est tracée serveur.
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code === "EROFS" || code === "EACCES" || code === "ENOSPC") {
      console.warn(
        `[chomage-ia upload] FS unavailable (${code}) — binary skipped, keeping extracted text only`
      );
      fileWriteWarning =
        "Le binaire n'a pas pu être conservé (filesystem en lecture seule). Le texte extrait est en place et exploitable par l'IA.";
    } else {
      // Autre erreur (ex: Prisma) — on re-throw, sera capturée par le wrap global.
      throw err;
    }
  }

  // 2. Extraction texte selon le kind, sauf si l'admin a déjà rempli `content`.
  let finalContent = content;
  let extractWarning: string | null = null;

  if (finalContent.length < 10) {
    let extracted = "";
    if (kind === "pdf") extracted = await extractPdfText(buffer);
    else if (kind === "docx") extracted = await extractDocxText(buffer);
    else if (kind === "xlsx") extracted = await extractXlsxText(buffer);
    else if (kind === "pptx") extracted = await extractPptxText(buffer);
    else if (kind === "image_caption") extracted = await ocrImage(buffer);

    if (extracted.length >= 50) {
      finalContent = extracted;
      if (kind === "image_caption") {
        extractWarning =
          "Caption auto-extrait par OCR (Tesseract). Édite la source si le texte reconnu est imparfait.";
      }
    } else {
      // Message d'aide spécifique par kind — guide vers la bonne action.
      if (kind === "pdf") {
        // pdfjs + pdf-parse + Tesseract OCR ont tous échoué. Le PDF est
        // probablement protégé, corrompu, ou la qualité du scan trop mauvaise
        // pour que Tesseract reconnaisse quoi que ce soit.
        finalContent =
          content ||
          `(PDF illisible — extraction texte et OCR ont tous deux échoué.)\n\nFichier : ${file.name}\nTaille : ${buffer.byteLength} octets\n\nCauses possibles :\n• PDF protégé par mot de passe\n• Scan de très mauvaise qualité (résolution < 150 dpi, texte flou)\n• PDF corrompu ou format non standard\n\nSi le fichier ouvre normalement dans un lecteur, essaie de :\n1. Re-scanner les pages en meilleure qualité (300 dpi minimum)\n2. Convertir chaque page en image JPG/PNG manuellement et les uploader\n3. Ou édite ce contenu manuellement avec un copier-coller du texte`;
        extractWarning =
          "Extraction texte + OCR ont échoué. PDF possiblement protégé, corrompu, ou scan trop basse qualité.";
      } else if (kind === "image_caption") {
        // OCR a échoué OU image sans texte exploitable.
        if (content.length < 10) {
          return NextResponse.json(
            {
              error:
                "L'OCR n'a pas pu extraire de texte de cette image. Ajoute une description manuelle (10 chars min) pour décrire son contenu.",
            },
            { status: 400 }
          );
        }
        finalContent = content;
      } else {
        const label =
          kind === "docx"
            ? "document Word"
            : kind === "xlsx"
            ? "fichier Excel"
            : kind === "pptx"
            ? "fichier PowerPoint"
            : "fichier";
        finalContent =
          content ||
          `(Contenu ${label} non extrait automatiquement — éditer manuellement.)\n\nFichier : ${file.name}\nTaille : ${buffer.byteLength} octets`;
        extractWarning = `Le texte n'a pas pu être extrait automatiquement (${label}). Édite la source pour ajouter le contenu.`;
      }
    }
  }

  // 3. Crée la KnowledgeSource (liée au File si on a pu le persister).
  const ks = await prisma.knowledgeSource.create({
    data: {
      title,
      kind,
      content: finalContent,
      summary: null,
      sourceUrl: sourceUrl || null,
      fileId: dbFile?.id ?? null,
      tags,
      enabled: true,
      domain,
      createdById: auth.user.id,
    },
  });

  console.log(
    `chomage-ia upload: ${kind} "${title}" (${buffer.byteLength}B, ext=${ext}) → ks=${ks.id} file=${dbFile?.id ?? "none"}`
  );

  // Concat des warnings : binaire skippé + extraction échouée.
  const combinedWarning =
    [fileWriteWarning, extractWarning].filter(Boolean).join(" · ") || null;

  return NextResponse.json(
    {
      id: ks.id,
      title: ks.title,
      kind: ks.kind,
      fileId: dbFile?.id ?? null,
      contentLength: finalContent.length,
      extractWarning: combinedWarning,
    },
    { status: 201 }
  );
}
