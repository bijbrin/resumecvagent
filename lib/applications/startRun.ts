/**
 * lib/applications/startRun.ts
 *
 * Shared "kick off the agent graph for a tracked application" logic, used by
 * both the per-application re-run route (`/api/applications/[id]/optimize`) and
 * the job-scanner optimize route (`/api/job-scraper/optimize`). Extracted so the
 * two entry points can't drift apart.
 *
 * PII invariant (see resumeweb/CLAUDE.md): the job folder is the system of
 * record for resume / cover-letter content. We run with `persistResultJson:
 * false` and write back only the PII-safe insight fields to Postgres.
 */
import "server-only";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { createInitialState } from "@/lib/state/resumeState";
import { runGraphInBackground } from "@/lib/graph/runOptimization";
import { readApplicationContent, readMasterContent } from "@/lib/sync/readContent";
import { exportApplication } from "@/lib/sync/exportApplication";
import { FILES } from "@/lib/sync/paths";
import {
  ApplicationStatus,
  RunStatus,
  Prisma,
  type JobApplication,
} from "@/lib/generated/prisma/client";

export interface StartRunResult {
  correlationId: string;
  status: "RUNNING";
}

export class StartRunError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

/**
 * Load an application's folder content, create an OptimizationRun, and schedule
 * the agent graph to run in the background. The resume falls back to the master
 * `MyResume.md` and the cover letter to `MyCoverLetter.md` when the folder has
 * none yet (the common case for a freshly-scraped job).
 *
 * Throws `StartRunError` with an HTTP status when inputs are insufficient.
 */
export async function startApplicationRun(
  app: JobApplication,
): Promise<StartRunResult> {
  const content = await readApplicationContent(app.folderPath);
  const master = await readMasterContent();
  const resumeText = content.resume ?? master.resume ?? "";
  const jobDescriptionText = content.jd ?? "";
  const coverLetterText = content.coverLetter ?? master.coverLetter ?? "";

  if (resumeText.trim().length < 50) {
    throw new StartRunError(
      "No resume found. Add Resume.md to the folder or a master MyResume.md.",
      422,
    );
  }
  if (jobDescriptionText.trim().length < 30 && !app.jobUrl) {
    throw new StartRunError(
      "No job description found. Add JD.md to the folder or set a jobUrl.",
      422,
    );
  }

  const run = await prisma.optimizationRun.create({
    data: {
      userId: app.userId,
      jobApplicationId: app.id,
      jobUrl: app.jobUrl ?? "",
      companyName: app.company,
      status: RunStatus.RUNNING,
    },
    select: { id: true, correlationId: true },
  });

  const initialState = createInitialState({
    correlationId: run.correlationId,
    resumeText,
    jobUrl: app.jobUrl ?? "",
    jobDescriptionText,
    coverLetterText,
    companyName: app.company,
  });

  after(async () => {
    await runGraphInBackground(run.id, initialState, {
      // Content lives in the folder, not Postgres — keep PII out of the DB.
      persistResultJson: false,
      onDone: async (result) => {
        // Move the application forward in its lifecycle on first tailoring.
        if (app.status === ApplicationStatus.DRAFT) {
          await prisma.jobApplication.update({
            where: { id: app.id },
            data: { status: ApplicationStatus.TAILORING },
          });
        }
        // Seed JD.md from the agent's scraped raw text when the folder has no
        // JD yet (e.g. a freshly-scraped job that only carried a jobUrl). We
        // don't overwrite an existing JD — the user may have edited it.
        if (!content.jd && result.jobDetails?.rawText?.trim()) {
          writeFileSync(
            path.join(app.folderPath, FILES.jd),
            result.jobDetails.rawText,
            "utf8",
          );
        }
        await exportApplication(prisma, app.id, {
          resume: result.optimizedResumeContent,
          coverLetter: result.optimizedCoverLetter,
          report: result.reportMarkdown,
          interview: result.interviewCheatsheet,
          correlationId: run.correlationId,
        });

        // Persist only the PII-safe insights (company research + JD breakdown +
        // fit score + warnings) so the detail page can show them.
        await prisma.optimizationRun.update({
          where: { id: run.id },
          data: {
            resultJson: {
              companyResearch: result.companyResearch,
              jobDetails: result.jobDetails,
              fitScore: result.fitScore,
              warnings: result.warnings,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
    });
  });

  return { correlationId: run.correlationId, status: "RUNNING" };
}
