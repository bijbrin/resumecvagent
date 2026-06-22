/**
 * lib/sync/frontmatter.ts
 *
 * Read/write the `application.yaml` metadata sidecar and hash file contents.
 * Pure module — no `server-only`, no DB. Safe for the CLI.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";

/**
 * Machine-owned metadata for a job application, persisted as `application.yaml`
 * in the job folder. Mirrors the JobApplication DB columns (minus userId/ids)
 * so the folder is self-describing and the DB stays the system of record for
 * tracking fields.
 */
export interface ApplicationMeta {
  company: string;
  role?: string | null;
  jobUrl?: string | null;
  location?: string | null;
  salary?: string | null;
  status?: string | null;
  appliedAt?: string | null; // ISO date
  deadline?: string | null;  // ISO date
  contactName?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  /** Last optimization run correlation id (most recent first). */
  correlationIds?: string[];
  /** sha256 of each managed file, keyed by file name. */
  fileHashes?: Record<string, string>;
  /** ISO timestamp of the last export written by the app. */
  syncedAt?: string;
}

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Read `application.yaml` from a folder. Returns null if absent or unparseable. */
export function readApplicationMeta(metaPath: string): ApplicationMeta | null {
  if (!existsSync(metaPath)) return null;
  try {
    const raw = readFileSync(metaPath, "utf8");
    const parsed = parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ApplicationMeta) : null;
  } catch {
    return null;
  }
}

/** Write `application.yaml`, sorting keys for stable diffs. */
export function writeApplicationMeta(metaPath: string, meta: ApplicationMeta): void {
  const yaml = stringify(meta, { sortMapEntries: true });
  writeFileSync(
    metaPath,
    `# Managed by ResumeCVAgent — application metadata. Safe to hand-edit.\n${yaml}`,
    "utf8",
  );
}
