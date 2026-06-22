/**
 * lib/sync/syncAll.ts
 *
 * Orchestrates folder ↔ DB sync across every job folder. PrismaClient injected.
 */

import type { PrismaClient } from "../generated/prisma/client";
import { listJobFolders } from "./paths";
import { importApplication, type ImportResult } from "./importApplication";
import { exportApplication, type ExportResult } from "./exportApplication";

/**
 * Resolve which user owns synced applications. The web app is effectively
 * single-user; the CLI has no Clerk session, so we resolve in order:
 *   1. JOB_SYNC_USER_ID env override
 *   2. the first existing user (the one who signed into the app)
 *   3. a created `local-cli` placeholder user
 */
export async function resolveSyncUserId(prisma: PrismaClient): Promise<string> {
  const override = process.env.JOB_SYNC_USER_ID?.trim();
  if (override) return override;

  const first = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (first) return first.id;

  const placeholder = await prisma.user.create({
    data: { id: "local-cli", email: "local-cli@localhost.invalid", name: "Local CLI" },
    select: { id: true },
  });
  return placeholder.id;
}

/** Bootstrap/refresh every folder on disk into the DB (folder → DB). */
export async function importAll(
  prisma: PrismaClient,
  userId: string,
): Promise<ImportResult[]> {
  const folders = listJobFolders();
  const results: ImportResult[] = [];
  for (const folder of folders) {
    results.push(await importApplication(prisma, userId, folder));
  }
  return results;
}

/** Export every DB application's metadata sidecar to its folder (DB → folder). */
export async function exportAll(
  prisma: PrismaClient,
  userId: string,
): Promise<ExportResult[]> {
  const apps = await prisma.jobApplication.findMany({
    where: { userId },
    select: { id: true },
  });
  const results: ExportResult[] = [];
  for (const app of apps) {
    results.push(await exportApplication(prisma, app.id));
  }
  return results;
}
