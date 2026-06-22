/**
 * lib/sync/paths.ts
 *
 * Filesystem layout of the job-application workspace.
 *
 * `resumeweb/` lives INSIDE the workspace root (`JobApplication/`), so by
 * default the workspace root is the parent of the current working directory.
 * Override with the JOB_WORKSPACE_DIR env var (e.g. in CI or when the app is
 * relocated).
 *
 * This module is pure (fs + path only). It deliberately does NOT import
 * `server-only` or `lib/db` so it can be used from the CLI sync script, which
 * runs in a plain Node context where `server-only` would throw.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// ─── Canonical file names inside a job folder ───────────────────────────────
export const FILES = {
  meta:        "application.yaml",
  jd:          "JD.md",
  resume:      "Resume.md",
  coverLetter: "CoverLetter.md",
  review:      "REVIEW.md",
  report:      "REPORT.md",
  interview:   "INTERVIEW.md",
  chat:        "Chat.md",
} as const;

// Markdown files that are NOT the job description. Any other *.md in a folder
// is treated as a legacy JD file (e.g. coreconsumable's `consumable.md`).
const NON_JD_MARKDOWN = new Set<string>([
  FILES.resume,
  FILES.coverLetter,
  FILES.review,
  FILES.report,
  FILES.interview,
  FILES.chat,
]);

// Directories under the workspace root that are never job folders.
const IGNORED_DIRS = new Set<string>(["resumeweb", "node_modules", "tools"]);

/** Absolute path to the workspace root that contains the job folders. */
export function getWorkspaceRoot(): string {
  const override = process.env.JOB_WORKSPACE_DIR?.trim();
  return override ? path.resolve(override) : path.resolve(process.cwd(), "..");
}

/** Master source-of-truth files at the workspace root. */
export function getMasterPaths(root = getWorkspaceRoot()) {
  return {
    resume:      path.join(root, "MyResume.md"),
    coverLetter: path.join(root, "MyCoverLetter.md"),
  };
}

export interface JobFolder {
  slug: string; // directory name, e.g. "giveagrab"
  path: string; // absolute path
}

/** List every job folder directly under the workspace root. */
export function listJobFolders(root = getWorkspaceRoot()): JobFolder[] {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => !name.startsWith(".") && !IGNORED_DIRS.has(name))
    .map((name) => ({ slug: name, path: path.join(root, name) }))
    .filter((f) => {
      try {
        return statSync(f.path).isDirectory();
      } catch {
        return false;
      }
    });
}

/** Resolve a single job folder by slug (does not require it to exist on disk). */
export function jobFolderPath(slug: string, root = getWorkspaceRoot()): string {
  return path.join(root, slug);
}

/**
 * Find the JD markdown file inside a folder, tolerating the legacy convention
 * where the JD was named after the company (e.g. `consumable.md`) instead of
 * `JD.md`. Returns an absolute path or null.
 */
export function findJdFile(folderPath: string): string | null {
  const canonical = path.join(folderPath, FILES.jd);
  if (existsSync(canonical)) return canonical;

  if (!existsSync(folderPath)) return null;
  const legacy = readdirSync(folderPath).find(
    (name) => name.toLowerCase().endsWith(".md") && !NON_JD_MARKDOWN.has(name),
  );
  return legacy ? path.join(folderPath, legacy) : null;
}
