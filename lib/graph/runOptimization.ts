import "server-only";
import { prisma } from "@/lib/db";
import { getResumeGraph } from "@/lib/graph/resumeBuilder";
import type { ResumeJobState } from "@/lib/state/resumeState";
import { RunStatus, Prisma } from "@/lib/generated/prisma/client";

/** Shape persisted to OptimizationRun.resultJson and passed to onDone. */
export interface OptimizationResult {
  optimizedResumeContent: string | null;
  optimizedCoverLetter:   string | null;
  interviewCheatsheet:    string | null;
  reportMarkdown:         string | null;
  fitScore:               number | null;
  warnings:               string[];
  companyResearch:        ResumeJobState["companyResearch"];
  jobDetails:             ResumeJobState["jobDetails"];
}

export interface RunOptions {
  /**
   * Persist the full result (incl. resume/cover-letter PII) to
   * OptimizationRun.resultJson. Default true (preserves the ad-hoc optimizer's
   * behavior). Set false for application-linked runs whose content is written
   * to the job folder instead — keeping PII out of Postgres.
   */
  persistResultJson?: boolean;
  /** Called after the run is marked DONE — used to write artifacts to disk. */
  onDone?: (result: OptimizationResult) => Promise<void>;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

/**
 * Run the LangGraph pipeline to completion, syncing live agent status to the DB
 * after each node and persisting the final result. Runs inside `after()` so the
 * HTTP response is already sent — all DB updates are best-effort.
 */
export async function runGraphInBackground(
  runId: string,
  initialState: ResumeJobState,
  options: RunOptions = {},
): Promise<void> {
  const { persistResultJson = true, onDone } = options;
  const graph = getResumeGraph();

  try {
    let finalState: ResumeJobState | undefined;

    const stream = await graph.stream(initialState, { streamMode: "values" });
    for await (const chunk of stream) {
      const state = chunk as ResumeJobState;
      finalState = state;
      try {
        await prisma.optimizationRun.update({
          where: { id: runId },
          data: {
            agentStatusJson: state.agentStatus as unknown as Prisma.InputJsonValue,
            warnings:        state.warnings,
          },
        });
      } catch (dbErr) {
        console.warn("[optimize] agentStatus sync failed (non-fatal):", errorMessage(dbErr));
      }
    }

    if (!finalState) throw new Error("Graph stream produced no final state");

    const result: OptimizationResult = {
      optimizedResumeContent: finalState.optimizedResumeContent ?? null,
      optimizedCoverLetter:   finalState.optimizedCoverLetter   ?? null,
      interviewCheatsheet:    finalState.interviewCheatsheet    ?? null,
      reportMarkdown:         finalState.reportMarkdown         ?? null,
      fitScore:               finalState.tailoringStrategy?.fitScore ?? null,
      warnings:               finalState.warnings,
      companyResearch:        finalState.companyResearch        ?? null,
      jobDetails:             finalState.jobDetails             ?? null,
    };

    // Run `onDone` (artifact writing, application promotion) BEFORE flipping the
    // run to DONE. Clients poll status and only fetch results once DONE is
    // observed, so this guarantees artifacts are on disk and the run is linked
    // to its JobApplication before anyone reads the result — no race where a
    // DONE run is missing its folder content or applicationId.
    if (onDone) {
      try {
        await onDone(result);
      } catch (cbErr) {
        console.error("[optimize] onDone callback failed:", errorMessage(cbErr));
      }
    }

    await prisma.optimizationRun.update({
      where: { id: runId },
      data: {
        status:      RunStatus.DONE,
        completedAt: new Date(),
        warnings:    finalState.warnings,
        ...(persistResultJson
          ? { resultJson: result as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });

    console.log("[optimize] run completed:", runId);
  } catch (err) {
    const msg = errorMessage(err);
    console.error("[optimize] graph invocation failed:", msg);
    try {
      await prisma.optimizationRun.update({
        where: { id: runId },
        data: {
          status:   RunStatus.FAILED,
          warnings: { push: `[background] Optimization failed: ${msg}` },
        },
      });
    } catch (dbErr) {
      console.error("[optimize] DB run update to FAILED failed:", errorMessage(dbErr));
    }
  }
}
