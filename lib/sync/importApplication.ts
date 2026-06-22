/**
 * lib/sync/importApplication.ts
 *
 * Explicit bootstrap: read a job folder on disk and upsert its METADATA into
 * the DB. This is the reverse (folder → DB) direction and is intentionally
 * conservative — on an existing row it refreshes only the folder path and file
 * hashes, never clobbering user-managed tracking fields (status, company,
 * dates). First import derives best-effort metadata from `application.yaml`,
 * the cover letter header, or the JD.
 *
 * PrismaClient is injected so this works from both the Next API route (passing
 * the `lib/db` singleton) and the CLI (passing its own client) — see the note
 * in lib/db.ts about `server-only`.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "../generated/prisma/client";
import { FILES, findJdFile, type JobFolder } from "./paths";
import { readApplicationMeta, sha256, type ApplicationMeta } from "./frontmatter";

const VALID_STATUSES = new Set([
  "DRAFT", "TAILORING", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "ARCHIVED",
]);

// Lines that commonly lead an Indeed/Seek/LinkedIn JD paste but are not the
// job title or company — skipped when guessing role/company.
const JD_BOILERPLATE = new Set<string>([
  "job details",
  "here's how the job details align with your profile.",
  "here’s how the job details align with your profile.",
  "pay", "job type", "shift and schedule", "benefits", "full job description",
  "qualifications", "responsibilities", "about the role", "about the job",
  "full-time", "part-time", "contract", "permanent", "location",
  "key responsibilities", "about us", "about the company",
]);

/**
 * A candidate role/company line should look like a label, not a sentence or UI
 * fragment. Rejects long prose, lines ending in a period, and stray markup.
 */
function looksLikeName(line: string): boolean {
  if (!line) return false;
  if (line.length > 60) return false;
  if (/[.!?]$/.test(line)) return false;
  if (/&[a-z]+;/i.test(line)) return false;
  if (/\b(seeking|looking for|we are|join|responsible)\b/i.test(line)) return false;
  return true;
}

/** Strip trailing UI noise like "- job post" or " logo" from a candidate line. */
function cleanHeadline(line: string): string {
  return line
    .replace(/-\s*job post\s*$/i, "")
    .replace(/\s+logo\s*$/i, "")
    .trim();
}

/** JD lines with boilerplate, salary, ratings, and bare numbers removed. */
function meaningfulJdLines(jd: string): string[] {
  return jd
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !JD_BOILERPLATE.has(l.toLowerCase()))
    .filter((l) => !/^\d+(\.\d+)?(\s|$)/.test(l)) // "4.7", "4.7 out of 5 stars"
    .filter((l) => !/^\$[\d,]/.test(l))           // salary line
    .filter((l) => !/^&[a-z]+;$/i.test(l))        // bare html entity (&nbsp;)
    .filter((l) => !/out of \d+ stars/i.test(l));
}

function titleCaseSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function readFileSafe(filePath: string): string | null {
  try {
    return existsSync(filePath) ? readFileSync(filePath, "utf8") : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort metadata derivation when no `application.yaml` exists yet.
 * Looks at the cover letter header ("Application for <role>" + company line)
 * and the JD, falling back to a title-cased slug for the company.
 */
function deriveMeta(folderPath: string, slug: string): ApplicationMeta {
  const cover = readFileSafe(path.join(folderPath, FILES.coverLetter)) ?? "";
  const jdFile = findJdFile(folderPath);
  const jd = jdFile ? (readFileSafe(jdFile) ?? "") : "";

  let role: string | null = null;
  let company: string | null = null;
  let location: string | null = null;
  let salary: string | null = null;

  // Location & salary first, so we can exclude the location line when guessing
  // the role from the JD.
  const salaryMatch = jd.match(/\$[\d,]+(?:\s*-\s*\$?[\d,]+)?\s*a\s*year/i);
  if (salaryMatch) salary = salaryMatch[0].trim();

  const locMatch = jd.match(/^([A-Z][A-Za-z .]+(?:QLD|NSW|VIC|ACT|SA|WA|NT|TAS)[^\n]*)$/m);
  if (locMatch) location = locMatch[1].trim();

  // Cover letter is the most reliable source: it carries an explicit
  // "Application for <role>" line and a clean "<Company> — <descriptor>" line.
  const roleMatch = cover.match(/^\s*Application for\s+(.+?)\s*$/im);
  if (roleMatch) role = roleMatch[1].trim();

  const coverLines = cover.split("\n").map((l) => l.trim()).filter(Boolean);
  const dashLine = coverLines.find(
    (l) => /[—–]/.test(l) && !/^Application for/i.test(l) && !/^Dear/i.test(l),
  );
  if (dashLine) {
    const candidate = dashLine.split(/[—–]/)[0].trim();
    if (looksLikeName(candidate)) company = candidate;
  }

  // JD fallback for the role only — scan just the top few meaningful lines (the
  // title sits near the top of a posting) and skip the location. Company is NOT
  // guessed from JD prose; it falls back to the slug below. Better null than wrong.
  if (!role) {
    const topLines = meaningfulJdLines(jd)
      .slice(0, 3)
      .map(cleanHeadline)
      .filter((l) => looksLikeName(l) && l !== location);
    if (topLines[0]) role = topLines[0];
  }

  return {
    company: company || titleCaseSlug(slug),
    role,
    location,
    salary,
    status: "DRAFT",
  };
}

/** Compute sha256 of every managed file that currently exists in the folder. */
export function computeFileHashes(folderPath: string): Record<string, string> {
  const hashes: Record<string, string> = {};
  const jdFile = findJdFile(folderPath);
  const entries: Array<[string, string | null]> = [
    [FILES.jd, jdFile],
    [FILES.resume, path.join(folderPath, FILES.resume)],
    [FILES.coverLetter, path.join(folderPath, FILES.coverLetter)],
    [FILES.review, path.join(folderPath, FILES.review)],
    [FILES.report, path.join(folderPath, FILES.report)],
    [FILES.interview, path.join(folderPath, FILES.interview)],
  ];
  for (const [name, fp] of entries) {
    const content = fp ? readFileSafe(fp) : null;
    if (content != null) hashes[name] = sha256(content);
  }
  return hashes;
}

export interface ImportResult {
  slug: string;
  action: "created" | "refreshed";
  id: string;
}

/**
 * Upsert one job folder's metadata into the DB for the given user.
 * - New row: derived/`application.yaml` metadata + folderPath + hashes.
 * - Existing row: refresh folderPath + fileHashes only (tracking fields stay
 *   user-managed).
 */
export async function importApplication(
  prisma: PrismaClient,
  userId: string,
  folder: JobFolder,
): Promise<ImportResult> {
  const metaPath = path.join(folder.path, FILES.meta);
  const fileMeta = readApplicationMeta(metaPath);
  const meta = fileMeta ?? deriveMeta(folder.path, folder.slug);
  const fileHashes = computeFileHashes(folder.path);

  const status =
    meta.status && VALID_STATUSES.has(meta.status) ? meta.status : "DRAFT";

  const existing = await prisma.jobApplication.findUnique({
    where: { userId_slug: { userId, slug: folder.slug } },
    select: { id: true },
  });

  if (existing) {
    await prisma.jobApplication.update({
      where: { id: existing.id },
      data: { folderPath: folder.path, fileHashes },
    });
    return { slug: folder.slug, action: "refreshed", id: existing.id };
  }

  const created = await prisma.jobApplication.create({
    data: {
      userId,
      slug:         folder.slug,
      company:      meta.company || titleCaseSlug(folder.slug),
      role:         meta.role ?? null,
      jobUrl:       meta.jobUrl ?? null,
      location:     meta.location ?? null,
      salary:       meta.salary ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status:       status as any,
      appliedAt:    meta.appliedAt ? new Date(meta.appliedAt) : null,
      deadline:     meta.deadline ? new Date(meta.deadline) : null,
      contactName:  meta.contactName ?? null,
      contactEmail: meta.contactEmail ?? null,
      notes:        meta.notes ?? null,
      folderPath:   folder.path,
      fileHashes,
    },
    select: { id: true },
  });
  return { slug: folder.slug, action: "created", id: created.id };
}
