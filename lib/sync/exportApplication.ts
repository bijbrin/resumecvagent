/**
 * lib/sync/exportApplication.ts
 *
 * Primary sync direction (DB → folder). Writes `application.yaml` from the DB
 * row and, when provided, the app-generated markdown artifacts (optimized
 * resume, cover letter, report, interview prep) into the job folder. Recomputes
 * file hashes and stores them back on the row.
 *
 * PrismaClient is injected (see lib/db.ts note about `server-only`).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "../generated/prisma/client";
import { buildResumeDocx } from "../docx/resumeDocx";
import { FILES } from "./paths";
import {
  readApplicationMeta,
  writeApplicationMeta,
  type ApplicationMeta,
} from "./frontmatter";
import { computeFileHashes } from "./importApplication";

/** App-generated content to write into the folder (all optional). */
export interface ExportArtifacts {
  resume?: string | null;
  coverLetter?: string | null;
  report?: string | null;
  interview?: string | null;
  /** Correlation id of the run that produced these artifacts. */
  correlationId?: string | null;
}

export interface ExportResult {
  slug: string;
  written: string[]; // file names written this call
}

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/**
 * Export one application to its folder. Always writes `application.yaml`;
 * writes each artifact file only when its content is provided (a metadata-only
 * sync leaves the content files untouched).
 */
export async function exportApplication(
  prisma: PrismaClient,
  appId: string,
  artifacts: ExportArtifacts = {},
): Promise<ExportResult> {
  const app = await prisma.jobApplication.findUnique({ where: { id: appId } });
  if (!app) throw new Error(`JobApplication ${appId} not found`);

  mkdirSync(app.folderPath, { recursive: true });
  const written: string[] = [];

  const writeMd = (fileName: string, content: string | null | undefined) => {
    if (content == null) return;
    writeFileSync(path.join(app.folderPath, fileName), content, "utf8");
    written.push(fileName);
  };

  writeMd(FILES.resume, artifacts.resume);
  writeMd(FILES.coverLetter, artifacts.coverLetter);
  writeMd(FILES.report, artifacts.report);
  writeMd(FILES.interview, artifacts.interview);

  // Render a styled Resume.docx alongside Resume.md so the folder stays
  // complete (matches the manual tools/resume-docx workflow). Non-fatal.
  if (artifacts.resume != null) {
    try {
      const docxBuf = await buildResumeDocx(artifacts.resume);
      writeFileSync(path.join(app.folderPath, "Resume.docx"), docxBuf);
      written.push("Resume.docx");
    } catch (err) {
      console.warn("[export] Resume.docx generation failed (non-fatal):",
        err instanceof Error ? err.message : err);
    }
  }

  // Build the metadata sidecar from the DB row, preserving any existing
  // correlationId history already on disk.
  const metaPath = path.join(app.folderPath, FILES.meta);
  const prevMeta = readApplicationMeta(metaPath);
  const correlationIds = [
    ...(artifacts.correlationId ? [artifacts.correlationId] : []),
    ...(prevMeta?.correlationIds ?? []),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 20);

  // computeFileHashes only covers content files, never the sidecar itself.
  const fileHashes = computeFileHashes(app.folderPath);

  const meta: ApplicationMeta = {
    company:      app.company,
    role:         app.role,
    jobUrl:       app.jobUrl,
    location:     app.location,
    salary:       app.salary,
    status:       app.status,
    appliedAt:    toIso(app.appliedAt),
    deadline:     toIso(app.deadline),
    contactName:  app.contactName,
    contactEmail: app.contactEmail,
    notes:        app.notes,
    correlationIds,
    fileHashes,
    syncedAt:     new Date().toISOString(),
  };
  writeApplicationMeta(metaPath, meta);
  written.push(FILES.meta);

  await prisma.jobApplication.update({
    where: { id: appId },
    data: { fileHashes },
  });

  return { slug: app.slug, written };
}
