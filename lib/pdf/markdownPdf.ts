/**
 * lib/pdf/markdownPdf.ts
 *
 * Lightweight, dependency-light PDF renderer for the tailored Resume.md and
 * CoverLetter.md, built with pdf-lib (no headless browser). It produces real,
 * selectable, ATS-friendly text — not a rasterised image — using the standard
 * Helvetica family. Styling mirrors the master spec where practical:
 *   - Centered dark-green (#075700) name with thin rules above/below
 *   - Centered contact line
 *   - Green section headings over a thin rule (centered for the resume,
 *     left-aligned for the cover letter)
 *   - Near-black body text, blue (#0000EE) clickable hyperlinks, green bullets
 *
 * Layout is intentionally single-column and simpler than the .docx (per the
 * chosen approach) — the .docx remains the pixel-faithful artifact.
 */

import {
  PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, PDFString,
} from "pdf-lib";

// ── geometry (US Letter, points) ─────────────────────────────────────────────
const PAGE_W = 612, PAGE_H = 792;
const M = { top: 50, bottom: 50, left: 60, right: 60 };
const CONTENT_W = PAGE_W - M.left - M.right; // 492

// ── palette ──────────────────────────────────────────────────────────────────
const GREEN = rgb(7 / 255, 87 / 255, 0);
const INK = rgb(26 / 255, 26 / 255, 26 / 255);
const BLUE = rgb(0, 0, 238 / 255);

const SZ = { name: 23, heading: 13, body: 10.5, contact: 10.5 };

type Align = "left" | "center" | "right";

interface Token { text: string; bold: boolean; link?: string }
interface Word { text: string; bold: boolean; link?: string; width: number; spaceBefore: boolean }

interface Doc {
  pdf: PDFDocument;
  reg: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number; // top of the next line
}

// ── inline parsing: **bold** and [text](url) ────────────────────────────────
function parseInline(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push({ text: text.slice(last, m.index), bold: false });
    if (m[1] !== undefined) tokens.push({ text: m[1], bold: true });
    else tokens.push({ text: m[2], bold: false, link: m[3] });
    last = re.lastIndex;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), bold: false });
  return tokens;
}

function fontFor(d: Doc, bold: boolean): PDFFont {
  return bold ? d.bold : d.reg;
}

function newPage(d: Doc): void {
  d.page = d.pdf.addPage([PAGE_W, PAGE_H]);
  d.y = PAGE_H - M.top;
}

function ensure(d: Doc, height: number): void {
  if (d.y - height < M.bottom) newPage(d);
}

function addLinkAnnotation(d: Doc, x: number, y: number, w: number, h: number, url: string): void {
  const annot = d.pdf.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [x, y, x + w, y + h],
    Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
  });
  d.page.node.addAnnot(d.pdf.context.register(annot));
}

// ── wrapped, styled paragraph ────────────────────────────────────────────────
function drawParagraph(
  d: Doc,
  tokens: Token[],
  opts: {
    size: number;
    color?: ReturnType<typeof rgb>;
    align?: Align;
    x0?: number;
    maxWidth?: number;
    spaceAfter?: number;
  },
): void {
  const size = opts.size;
  const color = opts.color ?? INK;
  const align: Align = opts.align ?? "left";
  const x0 = opts.x0 ?? M.left;
  const maxWidth = opts.maxWidth ?? CONTENT_W;
  const lineHeight = size * 1.42;
  const spaceW = d.reg.widthOfTextAtSize(" ", size);

  // tokens → words, tracking whether each word was preceded by real whitespace
  // (so punctuation like "**React**," doesn't get a stray space before it).
  const words: Word[] = [];
  let pendingSpace = false;
  for (const t of tokens) {
    for (const part of t.text.split(/(\s+)/)) {
      if (part === "") continue;
      if (/^\s+$/.test(part)) { pendingSpace = true; continue; }
      const f = fontFor(d, t.bold);
      words.push({
        text: part, bold: t.bold, link: t.link,
        width: f.widthOfTextAtSize(part, size), spaceBefore: pendingSpace && words.length > 0,
      });
      pendingSpace = false;
    }
  }
  if (words.length === 0) words.push({ text: "", bold: false, width: 0, spaceBefore: false });

  // greedy wrap
  const lines: Word[][] = [];
  let cur: Word[] = [];
  let curW = 0;
  for (const w of words) {
    const gap = cur.length && w.spaceBefore ? spaceW : 0;
    if (cur.length && curW + gap + w.width > maxWidth) {
      lines.push(cur);
      cur = [w];
      curW = w.width;
    } else {
      cur.push(w);
      curW += gap + w.width;
    }
  }
  if (cur.length) lines.push(cur);

  for (const line of lines) {
    ensure(d, lineHeight);
    const baseline = d.y - size;

    const lineW = line.reduce((acc, w, i) => acc + w.width + (i && w.spaceBefore ? spaceW : 0), 0);
    let x = x0;
    if (align === "center") x = x0 + (maxWidth - lineW) / 2;
    else if (align === "right") x = x0 + (maxWidth - lineW);

    for (let i = 0; i < line.length; i++) {
      const w = line[i];
      // Emit a real space glyph before this word when the source had one, so
      // PDF text extractors (ATS) keep words separated.
      if (i > 0 && w.spaceBefore) {
        d.page.drawText(" ", { x, y: baseline, size, font: d.reg, color });
        x += spaceW;
      }
      const f = fontFor(d, w.bold);
      const drawColor = w.link ? BLUE : color;
      d.page.drawText(w.text, { x, y: baseline, size, font: f, color: drawColor });
      if (w.link) {
        d.page.drawLine({
          start: { x, y: baseline - 1.5 }, end: { x: x + w.width, y: baseline - 1.5 },
          thickness: 0.6, color: BLUE,
        });
        addLinkAnnotation(d, x, baseline - 2, w.width, size + 2, w.link);
      }
      x += w.width;
    }
    d.y -= lineHeight;
  }
  if (opts.spaceAfter) d.y -= opts.spaceAfter;
}

function drawRule(d: Doc, thickness: number, gapBefore = 0, gapAfter = 0): void {
  d.y -= gapBefore;
  ensure(d, thickness + gapAfter);
  d.page.drawLine({
    start: { x: M.left, y: d.y }, end: { x: PAGE_W - M.right, y: d.y },
    thickness, color: GREEN,
  });
  d.y -= thickness + gapAfter;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase());
}

// ── document assembly ────────────────────────────────────────────────────────
type Kind = "resume" | "coverletter";

async function build(md: string, kind: Kind): Promise<Buffer> {
  const clean = md.replace(/<!--[\s\S]*?-->/g, "");
  const lines = clean.split(/\r?\n/);

  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const d: Doc = { pdf, reg, bold, page: pdf.addPage([PAGE_W, PAGE_H]), y: PAGE_H - M.top };

  const headingAlign: Align = kind === "resume" ? "center" : "left";
  let seenName = false, contactDone = false;
  let bulletBuf: string[] = [];

  const flushBullets = () => {
    for (const b of bulletBuf) {
      // hanging bullet: green dot drawn first (so it leads the text in the
      // content stream), then the wrapped text indented to its right.
      ensure(d, SZ.body * 1.42);
      const baselineY = d.y - SZ.body;
      d.page.drawText("•", { x: M.left + 2, y: baselineY, size: SZ.body, font: d.bold, color: GREEN });
      drawParagraph(d, parseInline(b), {
        size: SZ.body, x0: M.left + 16, maxWidth: CONTENT_W - 16, spaceAfter: 3,
      });
    }
    bulletBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line === "---") continue;

    if (line.startsWith("# ")) {
      flushBullets();
      drawRule(d, 1.2, 4, 6);
      drawParagraph(d, [{ text: line.slice(2).trim().toUpperCase(), bold: true }], {
        size: SZ.name, align: "center", color: GREEN, spaceAfter: 6,
      });
      drawRule(d, 1.2, 0, 8);
      seenName = true;
      continue;
    }
    if (line.startsWith("## ")) {
      flushBullets();
      d.y -= 8;
      drawParagraph(d, [{ text: titleCase(line.slice(3).trim()), bold: true }], {
        size: SZ.heading, align: headingAlign, color: GREEN, spaceAfter: 3,
      });
      drawRule(d, 0.8, 0, 8);
      contactDone = true;
      continue;
    }
    if (line.startsWith("- ")) {
      contactDone = true;
      bulletBuf.push(line.slice(2).trim());
      continue;
    }
    flushBullets();
    if (seenName && !contactDone) {
      drawParagraph(d, parseInline(line), { size: SZ.contact, align: "center", spaceAfter: 10 });
      contactDone = true;
      continue;
    }
    drawParagraph(d, parseInline(line), { size: SZ.body, spaceAfter: kind === "coverletter" ? 9 : 5 });
  }
  flushBullets();

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/** Render Resume.md markdown into PDF bytes (selectable text). */
export function buildResumePdf(md: string): Promise<Buffer> {
  return build(md, "resume");
}

/** Render CoverLetter.md markdown into PDF bytes (selectable text). */
export function buildCoverLetterPdf(md: string): Promise<Buffer> {
  return build(md, "coverletter");
}
