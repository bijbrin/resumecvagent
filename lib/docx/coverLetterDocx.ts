/**
 * lib/docx/coverLetterDocx.ts
 *
 * Render a tailored CoverLetter.md into a styled, ATS-friendly .docx that shares
 * the master resume letterhead so the two documents look like a set:
 *   - US Letter, Source Sans Pro
 *   - Centered dark-green (#075700) name (23pt) with thin rules above/below
 *   - Centered contact line under the name
 *   - Left-aligned near-black body (11pt), blue (#0000EE) hyperlinks
 *   - "## Heading" → small-caps green section heading (rare in a letter)
 *   - "- item"     → green bullet list
 *
 * ATS notes: real selectable text top-to-bottom, no decorative glyphs.
 * Mirrors the helpers in `resumeDocx.ts`; keep the two in sync if the markdown
 * conventions change.
 */

import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, ExternalHyperlink, BorderStyle, LevelFormat,
  type ParagraphChild, type IParagraphOptions, type IBorderOptions,
} from "docx";

// ── style constants (shared with the resume spec) ───────────────────────────
const GREEN = "075700";
const BLUE  = "0000EE";
const INK   = "1A1A1A";
const FONT  = "Source Sans Pro";

const SZ = { name: 46, heading: 26, body: 22, contact: 22 };
const MARGIN = { top: 864, bottom: 864, left: 1080, right: 1080 };

const ruleBorder = (size: number): IBorderOptions => ({
  style: BorderStyle.SINGLE, size, color: GREEN, space: 2,
});

interface InlineOpts { size?: number; bold?: boolean; color?: string }

// ── inline parsing: **bold** and [text](url) ────────────────────────────────
function run(text: string, opts: InlineOpts = {}): TextRun {
  return new TextRun({
    text, font: FONT, size: opts.size ?? SZ.body, bold: opts.bold,
    color: opts.color ?? INK,
  });
}
function hyperlink(text: string, url: string, opts: InlineOpts = {}): ExternalHyperlink {
  return new ExternalHyperlink({
    link: url,
    children: [new TextRun({ text, font: FONT, size: opts.size ?? SZ.body, color: BLUE, underline: {} })],
  });
}
function parseInline(text: string, opts: InlineOpts = {}): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push(run(text.slice(last, m.index), opts));
    if (m[1] !== undefined) runs.push(run(m[1], { ...opts, bold: true }));
    else runs.push(hyperlink(m[2], m[3], opts));
    last = re.lastIndex;
  }
  if (last < text.length) runs.push(run(text.slice(last), opts));
  return runs.length ? runs : [run("", opts)];
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase());
}

// ── block builders ──────────────────────────────────────────────────────────
function nameP(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 60 },
    border: { top: ruleBorder(8), bottom: ruleBorder(8) },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: SZ.name, color: GREEN, font: FONT })],
  });
}
function contactP(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: parseInline(text, { size: SZ.contact }),
  });
}
function headingP(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 180, after: 80 },
    border: { bottom: ruleBorder(6) },
    children: [new TextRun({
      text: titleCase(text), bold: true, smallCaps: true,
      size: SZ.heading, color: GREEN, font: FONT,
    })],
  });
}
function bodyP(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT, spacing: { after: 140 },
    children: parseInline(text, {}),
  });
}
function bulletP(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "cl-bullets", level: 0 }, spacing: { after: 60 },
    children: parseInline(text, { size: SZ.body }),
  } as IParagraphOptions);
}

// ── parse markdown into a Document ──────────────────────────────────────────
function build(md: string): Document {
  md = md.replace(/<!--[\s\S]*?-->/g, ""); // strip comment / style-spec blocks
  const lines = md.split(/\r?\n/);
  const children: Paragraph[] = [];
  let seenName = false, contactDone = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line === "---") continue;
    if (line.startsWith("# ")) { children.push(nameP(line.slice(2).trim())); seenName = true; continue; }
    if (line.startsWith("## ")) { children.push(headingP(line.slice(3).trim())); contactDone = true; continue; }
    if (line.startsWith("- ")) { contactDone = true; children.push(bulletP(line.slice(2).trim())); continue; }
    // First non-heading line after the name is the contact/letterhead line.
    if (seenName && !contactDone) { children.push(contactP(line)); contactDone = true; continue; }
    children.push(bodyP(line));
  }

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: SZ.body, color: INK } } } },
    numbering: {
      config: [{
        reference: "cl-bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { run: { color: GREEN, font: FONT }, paragraph: { indent: { left: 300, hanging: 200 } } },
        }],
      }],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: MARGIN } },
      children,
    }],
  });
}

/** Render CoverLetter.md markdown into .docx bytes. */
export function buildCoverLetterDocx(md: string): Promise<Buffer> {
  return Packer.toBuffer(build(md));
}
