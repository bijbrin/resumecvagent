/**
 * lib/applications/promoteRun.ts
 *
 * Promote a completed ad-hoc optimizer run (launched from the /optimizer form)
 * into a first-class JobApplication: create the job folder, write the agent
 * artifacts (JD, Resume, Cover Letter, Report, Interview) to disk, render the
 * styled Resume.docx, write application.yaml, create the DB row, and link the
 * OptimizationRun to it.
 *
 * Once promotion succeeds, the optimizer's "View results" navigates to
 * /applications/:id — the same rich view (DocumentPanel with edit / regenerate
 * .docx + .pdf / download, AI Chat, insights) used by tracked applications.
 *
 * PII invariant: resume / cover-letter bodies live only in the folder. Only the
 * PII-safe insights (company research, JD breakdown, fit score, warnings) are
 * persisted to OptimizationRun.resultJson — mirroring startApplicationRun.
 */
import "server-only";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { ApplicationStatus, Prisma } from "@/lib/generated/prisma/client";
import { FILES, jobFolderPath, getWorkspaceRoot } from "@/lib/sync/paths";
import { exportApplication } from "@/lib/sync/exportApplication";
import type { OptimizationResult } from "@/lib/graph/runOptimization";

export interface PromoteRunInput {
  userId: string;
  runId: string;
  correlationId: string;
  jobUrl: string;
  companyName?: string | null;
  /** Pasted JD text from the optimizer form (fallback when no scraped text). */
  jobDescriptionText?: string | null;
  result: OptimizationResult;
}

export interface PromoteRunResult {
  appId: string;
  slug: string;
}

/** Sanitize a company / hostname into a lowercase folder-safe slug. */
function baseSlugFrom(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[^\w.-]+/g, "")
    .replace(/^[.-]+|[.-]+$/g, "");
  return cleaned || "application";
}

/** Return a slug unique for this user, appending -2, -3, … on collisions. */
async function uniqueSlug(userId: string, base: string): Promise<string> {
  const existing = await prisma.jobApplication.findMany({
    where: { userId, slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((a) => a.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Materialize a JobApplication + folder from a finished optimizer run. Throws
 * on failure — the caller (runGraphInBackground's onDone) catches and logs,
 * leaving the run unlinked (the client surfaces a friendly error).
 */
export async function promoteOptimizationRunToApplication(
  input: PromoteRunInput,
): Promise<PromoteRunResult> {
  const { userId, runId, correlationId, jobUrl, result } = input;
  const jd = result.jobDetails;

  const company =
    jd?.company?.trim() ||
    input.companyName?.trim() ||
    "Untitled company";
  const role = jd?.title?.trim() || null;

  const base = baseSlugFrom(company) || baseSlugFrom(jobUrl);
  const slug = await uniqueSlug(userId, base);
  const folderPath = jobFolderPath(slug, getWorkspaceRoot());
  mkdirSync(folderPath, { recursive: true });

  const writeMd = (fileName: string, content: string | null | undefined) => {
    if (content == null || content.trim() === "") return;
    writeFileSync(path.join(folderPath, fileName), content, "utf8");
  };

  // JD — prefer the agent's scraped raw text, then the pasted description, then
  // a pointer to the job URL so the tab isn't empty.
  const jdBody =
    jd?.rawText?.trim() ||
    input.jobDescriptionText?.trim() ||
    (jobUrl ? `_Job description scraped from ${jobUrl}._` : null);
  writeMd(FILES.jd, jdBody);

  writeMd(FILES.resume,      result.optimizedResumeContent);
  writeMd(FILES.coverLetter, result.optimizedCoverLetter);
  writeMd(FILES.report,      result.reportMarkdown);
  writeMd(FILES.interview,   result.interviewCheatsheet);

  // Create the DB row with known meta (no best-effort guessing — we have the
  // parsed job details + form inputs). `uniqueSlug` above is check-then-act —
  // two concurrent promotes for the same company can race past it and collide
  // on the @@unique([userId, slug]) constraint. Fall back to a timestamped
  // slug on that race instead of losing the run.
  let app: { id: string; slug: string };
  try {
    app = await prisma.jobApplication.create({
      data: {
        userId,
        slug,
        company,
        role,
        jobUrl:    jobUrl || null,
        location:  jd?.location ?? null,
        salary:    jd?.salary   ?? null,
        status:    ApplicationStatus.DRAFT,
        folderPath,
      },
      select: { id: true, slug: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const fallbackSlug = `${slug}-${Date.now()}`;
      app = await prisma.jobApplication.create({
        data: {
          userId,
          slug: fallbackSlug,
          company,
          role,
          jobUrl:    jobUrl || null,
          location:  jd?.location ?? null,
          salary:    jd?.salary   ?? null,
          status:    ApplicationStatus.DRAFT,
          folderPath,
        },
        select: { id: true, slug: true },
      });
    } else {
      throw err;
    }
  }

  // Writes Resume.docx + application.yaml (with correlationIds + fileHashes)
  // and updates the row's fileHashes.
  await exportApplication(prisma, app.id, {
    resume:        result.optimizedResumeContent,
    coverLetter:   result.optimizedCoverLetter,
    report:        result.reportMarkdown,
    interview:     result.interviewCheatsheet,
    correlationId,
  });

  // Link the run to the application and persist only PII-safe insights.
  await prisma.optimizationRun.update({
    where: { id: runId },
    data: {
      jobApplicationId: app.id,
      resultJson: {
        companyResearch: result.companyResearch,
        jobDetails:      result.jobDetails,
        fitScore:        result.fitScore,
        warnings:        result.warnings,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return { appId: app.id, slug: app.slug };
}
