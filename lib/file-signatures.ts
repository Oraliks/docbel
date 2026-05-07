type Signature = { bytes: number[]; offset: number };

const sig = (bytes: number[], offset = 0): Signature => ({ bytes, offset });

const ZIP_SIGS: Signature[] = [
  sig([0x50, 0x4b, 0x03, 0x04]),
  sig([0x50, 0x4b, 0x05, 0x06]),
  sig([0x50, 0x4b, 0x07, 0x08]),
];

const OLE2_SIG: Signature = sig([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const SIGNATURES: Record<string, Signature[]> = {
  pdf: [sig([0x25, 0x50, 0x44, 0x46])],
  docx: ZIP_SIGS,
  xlsx: ZIP_SIGS,
  pptx: ZIP_SIGS,
  doc: [OLE2_SIG],
  xls: [OLE2_SIG],
  ppt: [OLE2_SIG],
  jpg: [sig([0xff, 0xd8, 0xff])],
  jpeg: [sig([0xff, 0xd8, 0xff])],
  png: [sig([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  gif: [
    sig([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
    sig([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  ],
  webp: [sig([0x52, 0x49, 0x46, 0x46]), sig([0x57, 0x45, 0x42, 0x50], 8)],
  zip: ZIP_SIGS,
  rar: [sig([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])],
  "7z": [sig([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])],
  mp4: [sig([0x66, 0x74, 0x79, 0x70], 4)],
  mov: [sig([0x66, 0x74, 0x79, 0x70], 4)],
  avi: [sig([0x52, 0x49, 0x46, 0x46]), sig([0x41, 0x56, 0x49, 0x20], 8)],
  webm: [sig([0x1a, 0x45, 0xdf, 0xa3])],
};

// Text/textual formats: no reliable magic header. Validated by extension+MIME only.
const SKIP_SIGNATURE_CHECK = new Set(["txt", "csv", "svg"]);

// Extensions where ALL signatures must match (composite header).
const ALL_MUST_MATCH = new Set(["webp", "avi"]);

function startsWithAt(buffer: Buffer, bytes: number[], offset: number): boolean {
  if (buffer.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[offset + i] !== bytes[i]) return false;
  }
  return true;
}

export function matchesSignature(buffer: Buffer, ext: string): boolean {
  const lower = ext.toLowerCase();
  if (SKIP_SIGNATURE_CHECK.has(lower)) return true;
  const variants = SIGNATURES[lower];
  if (!variants) return false;
  if (ALL_MUST_MATCH.has(lower)) {
    return variants.every((s) => startsWithAt(buffer, s.bytes, s.offset));
  }
  return variants.some((s) => startsWithAt(buffer, s.bytes, s.offset));
}
