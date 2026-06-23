import "server-only";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

export type ExtractedResume = {
  text: string;
  source: "PDF" | "DOCX";
};

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function detectSource(file: File): "PDF" | "DOCX" | null {
  if (file.type === PDF_MIME || file.name.toLowerCase().endsWith(".pdf")) return "PDF";
  if (file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx")) return "DOCX";
  return null;
}

// file.type and file.name are both client-controlled — a malicious upload could
// claim "application/pdf" with arbitrary bytes. Cross-check the real file
// content against each format's magic-byte signature before parsing it.
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
const DOCX_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // ZIP local file header ("PK\x03\x04")

function matchesMagicBytes(buffer: Buffer, magic: number[]): boolean {
  return magic.every((byte, i) => buffer[i] === byte);
}

export async function extractResumeText(file: File): Promise<ExtractedResume> {
  const source = detectSource(file);
  if (!source) {
    throw new Error("Unsupported file type — only PDF and DOCX are accepted.");
  }
  if (file.size > MAX_RESUME_BYTES) {
    throw new Error("File too large — max 5 MB.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const magic = source === "PDF" ? PDF_MAGIC : DOCX_MAGIC;
  if (!matchesMagicBytes(buffer, magic)) {
    throw new Error("File content doesn't match its extension — the upload may be corrupted or mislabeled.");
  }

  const text = source === "PDF" ? await extractPdf(buffer) : await extractDocx(buffer);
  const trimmed = text.trim();

  if (trimmed.length < 20) {
    throw new Error("Could not extract usable text from the file — it may be scanned or image-only.");
  }
  return { text: trimmed, source };
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // pdf-parse v2 exposes a PDFParse class — constructor takes a Buffer/TypedArray
  // and getText() returns a TextResult with a concatenated `text` field.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy().catch(() => { /* ignore */ });
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}
