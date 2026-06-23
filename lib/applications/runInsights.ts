import "server-only";
import { prisma } from "@/lib/db";
import { RunStatus } from "@/lib/generated/prisma/client";
import type { CompanyResearch, JobDetails } from "@/lib/state/resumeState";

/**
 * Signals an application inherits from its most recent successful optimization
 * run. The markdown bodies live on disk (see readContent), but the structured
 * research — company profile, fit score, JD breakdown, agent warnings — is only
 * captured in OptimizationRun.resultJson. This is the bridge that lets the
 * application detail page show the same rich context the optimizer results view
 * gets from localStorage.
 */
export interface ApplicationInsights {
  companyResearch: CompanyResearch | null;
  jobDetails:      JobDetails | null;
  fitScore:        number | null;
  warnings:        string[];
  /** Correlation id of the run these insights came from (null when none). */
  correlationId:   string | null;
}

// Shape of the JSON blob OptimizationRun.resultJson stores (see
// app/api/optimize/result/[correlationId]/route.ts).
interface ResultPayload {
  fitScore:        number | null;
  warnings:        string[];
  companyResearch: CompanyResearch | null;
  jobDetails:      JobDetails | null;
}

const EMPTY: ApplicationInsights = {
  companyResearch: null,
  jobDetails:      null,
  fitScore:        null,
  warnings:        [],
  correlationId:   null,
};

/**
 * Load insights from the latest DONE run linked to this application. Returns
 * empty (all null / []) when the application has never been optimized.
 */
export async function getApplicationInsights(appId: string, userId: string): Promise<ApplicationInsights> {
  const run = await prisma.optimizationRun.findFirst({
    where: { jobApplicationId: appId, userId, status: RunStatus.DONE },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    select: { correlationId: true, resultJson: true, warnings: true },
  });

  if (!run) return EMPTY;

  const result = (run.resultJson as unknown as ResultPayload | null) ?? null;
  return {
    companyResearch: result?.companyResearch ?? null,
    jobDetails:      result?.jobDetails ?? null,
    fitScore:        result?.fitScore ?? null,
    warnings:        result?.warnings ?? run.warnings ?? [],
    correlationId:   run.correlationId,
  };
}
