/**
 * lib/docx/resumeDocx.ts
 *
 * Render a tailored Resume.md into a styled, ATS-friendly .docx matching
 * Bijaya's master style spec:
 *   - US Letter, Source Sans Pro
 *   - Centered dark-green (#075700) name (23pt) with thin rules above/below
 *   - Centered SMALL-CAPS green section headings (13pt) over a thin green rule
 *   - Justified near-black body (11pt), blue (#0000EE) hyperlinks
 *   - EXPERTISE as a borderless two-column table of green bullet-list items
 *   - A " ♦ "-separated showcase line (GitHub / Portfolio) split left/right
 *
 * ATS notes: real selectable text top-to-bottom; the only tables are simple
 * content grids (skills, the GitHub/Portfolio line) with no merged cells —
 * standard parsers read these fine. (Per the docx skill: paragraph borders for
 * rules, list numbering for bullets — never unicode bullet glyphs.)
 *
 * TypeScript port of the CLI converter at `tools/resume-docx/md-to-docx.js`.
 * Keep the two in sync if the markdown structure changes.
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, ExternalHyperlink, BorderStyle, LevelFormat, WidthType,
  type ParagraphChild, type IParagraphOptions, type IBorderOptions,
} from "docx";

// ── style constants (the spec) ──────────────────────────────────────────────
const GREEN = "075700"; // headings, name, rules, bullets
const BLUE  = "0000EE"; // hyperlinks
const INK   = "1A1A1A"; // body text
const WHITE = "FFFFFF"; // invisible table borders
const FONT  = "Source Sans Pro";

// half-points (×2 of pt): name 23pt, heading 13pt, body/contact/bullets 11pt
const SZ = { name: 46, heading: 26, body: 22, small: 22, contact: 22 };

// Page geometry: US Letter, 0.6" top/bottom, 0.75" left/right.
const MARGIN = { top: 864, bottom: 864, left: 1080, right: 1080 };
const CONTENT_WIDTH = 12240 - MARGIN.left - MARGIN.right; // 10080 DXA
const HALF = Math.round(CONTENT_WIDTH / 2);               // 5040 — column width

const ruleBorder = (size: number): IBorderOptions => ({
  style: BorderStyle.SINGLE, size, color: GREEN, space: 2,
});
const invisible: IBorderOptions = { style: BorderStyle.SINGLE, size: 2, color: WHITE, space: 0 };
const noBorders = {
  top: invisible, bottom: invisible, left: invisible, right: invisible,
  insideHorizontal: invisible, insideVertical: invisible,
};

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

// Title-case so SMALL CAPS renders with the large-initial look.
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
    alignment: AlignmentType.CENTER, spacing: { after: 140 },
    children: parseInline(text, { size: SZ.contact }),
  });
}
function headingP(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 220, after: 100 },
    border: { bottom: ruleBorder(6) },
    children: [new TextRun({
      text: titleCase(text), bold: true, smallCaps: true,
      size: SZ.heading, color: GREEN, font: FONT,
    })],
  });
}
function bodyP(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 },
    children: parseInline(text, {}),
  });
}
function bulletP(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 },
    children: parseInline(text, { size: SZ.small }),
  } as IParagraphOptions);
}

// EXPERTISE: borderless two-column table, each cell a green bullet-list item.
function bulletCell(text: string | undefined): TableCell {
  return new TableCell({
    width: { size: HALF, type: WidthType.DXA },
    borders: noBorders,
    margins: { top: 20, bottom: 20, left: 60, right: 60 },
    children: [
      text != null
        ? new Paragraph({
            numbering: { reference: "bullets", level: 0 }, spacing: { after: 50 },
            children: parseInline(text, { size: SZ.small }),
          } as IParagraphOptions)
        : new Paragraph({ children: [] }),
    ],
  });
}
function expertiseTable(items: string[]): Table {
  const rows: TableRow[] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(new TableRow({ children: [bulletCell(items[i]), bulletCell(items[i + 1])] }));
  }
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [HALF, HALF],
    borders: noBorders,
    rows,
  });
}

// A " ♦ "/" ◆ "-separated line (e.g. GitHub | Portfolio) → borderless 2-col table.
function dividerLineTable(left: string, right: string): Table {
  const cell = (text: string, align: (typeof AlignmentType)[keyof typeof AlignmentType]): TableCell =>
    new TableCell({
      width: { size: HALF, type: WidthType.DXA },
      borders: noBorders,
      margins: { top: 20, bottom: 20, left: 60, right: 60 },
      children: [new Paragraph({ alignment: align, spacing: { after: 60 }, children: parseInline(text, {}) })],
    });
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [HALF, HALF],
    borders: noBorders,
    rows: [new TableRow({ children: [cell(left, AlignmentType.LEFT), cell(right, AlignmentType.RIGHT)] })],
  });
}

// ── parse markdown into a Document ──────────────────────────────────────────
const DIVIDER = / [♦◆] /;

function build(md: string): Document {
  md = md.replace(/<!--[\s\S]*?-->/g, ""); // strip comment / style-spec blocks
  const lines = md.split(/\r?\n/);
  const children: (Paragraph | Table)[] = [];
  let seenName = false, contactDone = false, section = "";
  let pendingBullets: string[] = [];

  const flushBullets = () => {
    if (!pendingBullets.length) return;
    if (/EXPERTISE/i.test(section)) children.push(expertiseTable(pendingBullets));
    else pendingBullets.forEach((b) => children.push(bulletP(b)));
    pendingBullets = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line === "---") continue;
    if (line.startsWith("# ")) { flushBullets(); children.push(nameP(line.slice(2).trim())); seenName = true; continue; }
    if (line.startsWith("## ")) { flushBullets(); section = line.slice(3).trim(); children.push(headingP(section)); contactDone = true; continue; }
    if (line.startsWith("- ")) { contactDone = true; pendingBullets.push(line.slice(2).trim()); continue; }
    flushBullets();
    if (seenName && !contactDone) { children.push(contactP(line)); contactDone = true; continue; }
    // A divider-separated line (GitHub ♦ Portfolio) becomes a two-column row.
    if (contactDone && DIVIDER.test(line)) {
      const idx = line.search(DIVIDER);
      children.push(dividerLineTable(line.slice(0, idx).trim(), line.slice(idx + 3).trim()));
      continue;
    }
    children.push(bodyP(line));
  }
  flushBullets();

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: SZ.body, color: INK } } } },
    numbering: {
      config: [{
        reference: "bullets",
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

/** Render Resume.md markdown into .docx bytes. */
export function buildResumeDocx(md: string): Promise<Buffer> {
  return Packer.toBuffer(build(md));
}
