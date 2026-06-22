/**
 * lib/sync/readContent.ts
 *
 * Load the markdown bodies of a job folder on demand. Content is NOT stored in
 * the DB (PII invariant), so the detail view and the agent re-run read it from
 * disk through here. Pure module — no `server-only`, no DB.
 */

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { FILES, findJdFile, getMasterPaths } from "./paths";
import { readChat, type ChatMessage } from "./chat";

export interface ApplicationContent {
  jd: string | null;
  resume: string | null;
  coverLetter: string | null;
  review: string | null;
  report: string | null;
  interview: string | null;
  chat: ChatMessage[];
}

async function readIfExists(filePath: string | null): Promise<string | null> {
  if (!filePath) return null;
  try {
    await access(filePath);
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/** Read all known content files from a job folder. Missing files become null. */
export async function readApplicationContent(folderPath: string): Promise<ApplicationContent> {
  return {
    jd:          await readIfExists(findJdFile(folderPath)),
    resume:      await readIfExists(path.join(folderPath, FILES.resume)),
    coverLetter: await readIfExists(path.join(folderPath, FILES.coverLetter)),
    review:      await readIfExists(path.join(folderPath, FILES.review)),
    report:      await readIfExists(path.join(folderPath, FILES.report)),
    interview:   await readIfExists(path.join(folderPath, FILES.interview)),
    chat:        readChat(folderPath),
  };
}

/** Master resume / cover letter used to seed a new application's files. */
export async function readMasterContent(): Promise<{ resume: string | null; coverLetter: string | null }> {
  const master = getMasterPaths();
  return {
    resume:      await readIfExists(master.resume),
    coverLetter: await readIfExists(master.coverLetter),
  };
}
