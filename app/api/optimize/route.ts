import { NextRequest, NextResponse, after } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getResumeGraph } from "@/lib/graph/resumeBuilder";
import { createInitialState, type ResumeJobState } from "@/lib/state/resumeState";
import { RunStatus, Prisma } from "@/lib/generated/prisma/client";

// Node.js runtime required: Prisma, LangGraph, and the LLM toolchain
// need Node APIs that are unavailable in the Edge runtime.
export const runtime = "nodejs";

const BodySchema = z.object({
  resumeText:         z.string().min(50, "Resume must be at least 50 characters"),
  jobUrl:             z.string().regex(/^https?:\/\//, "Job URL must start with http:// or https://"),
  jobDescriptionText: z.string().optional().default(""),
  coverLetterText:    z.string().optional().default(""),
  companyUrl:         z.string().optional().default(""),
  companyName:        z.string().optional().default(""),
});

// Serialise any thrown value to a readable string for logging.
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

export async function POST(req: NextRequest) {
  // ── Top-level guard — ensures every failure path returns JSON ─────────────
  try {
    return await handleOptimize(req);
  } catch (err) {
    console.error("[optimize] unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: errorMessage(err) },
      { status: 500 },
    );
  }
}

async function handleOptimize(req: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: z.prettifyError(parsed.error) },
      { status: 422 },
    );
  }

  const data = parsed.data;

  // ── Upsert user row ───────────────────────────────────────────────────────
  let email = `${userId}@unknown.invalid`;
  try {
    const clerk     = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    email = clerkUser.emailAddresses[0]?.emailAddress ?? email;
  } catch (err) {
    console.warn("[optimize] Clerk user fetch failed, using fallback email:", errorMessage(err));
  }

  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email },
    });
  } catch (err) {
    console.error("[optimize] DB user upsert failed:", errorMessage(err));
    return NextResponse.json(
      { error: "Database error — check DATABASE_URL and run prisma db push.", detail: errorMessage(err) },
      { status: 503 },
    );
  }

  // ── Create OptimizationRun ────────────────────────────────────────────────
  let run: { id: string; correlationId: string };
  try {
    run = await prisma.optimizationRun.create({
      data: {
        userId,
        jobUrl:      data.jobUrl,
        companyName: data.companyName || null,
        status:      RunStatus.RUNNING,
      },
      select: { id: true, correlationId: true },
    });
  } catch (err) {
    console.error("[optimize] DB run create failed:", errorMessage(err));
    return NextResponse.json(
      { error: "Database error — could not create optimization run.", detail: errorMessage(err) },
      { status: 503 },
    );
  }

  const correlationId = run.correlationId;

  // ── Build initial state ───────────────────────────────────────────────────
  const initialState = createInitialState({
    correlationId,
    resumeText:         data.resumeText,
    jobUrl:             data.jobUrl,
    jobDescriptionText: data.jobDescriptionText,
    coverLetterText:    data.coverLetterText,
    companyUrl:         data.companyUrl,
    companyName:        data.companyName,
  });

  // ── Return immediately — the client polls for progress and results ────────
  after(async () => {
    await runGraphInBackground(run.id, initialState);
  });

  return NextResponse.json(
    { correlationId, status: "RUNNING" },
    { status: 202 },
  );
}

// ── Background graph execution ──────────────────────────────────────────────
// Runs inside after() so the HTTP response is already sent. All DB updates
// are best-effort — errors are logged but cannot be returned to the client.

async function runGraphInBackground(
  runId: string,
  initialState: ResumeJobState,
): Promise<void> {
  const graph = getResumeGraph();

  try {
    let finalState: ResumeJobState | undefined;

    // Stream the graph step-by-step so we can sync agentStatus to the DB
    // after every node completion. This lets the status endpoint show live
    // progress without SSE.
    const stream = await graph.stream(initialState, { streamMode: "values" });

    for await (const chunk of stream) {
      const state = chunk as ResumeJobState;
      finalState = state;

      // Best-effort sync of live progress to the DB
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

    if (!finalState) {
      throw new Error("Graph stream produced no final state");
    }

    // Persist the completed run
    const result = {
      optimizedResumeContent: finalState.optimizedResumeContent ?? null,
      optimizedCoverLetter:   finalState.optimizedCoverLetter   ?? null,
      interviewCheatsheet:    finalState.interviewCheatsheet    ?? null,
      reportMarkdown:         finalState.reportMarkdown         ?? null,
      fitScore:               finalState.tailoringStrategy?.fitScore ?? null,
      warnings:               finalState.warnings,
      companyResearch:        finalState.companyResearch        ?? null,
      jobDetails:             finalState.jobDetails             ?? null,
    };

    await prisma.optimizationRun.update({
      where: { id: runId },
      data: {
        status:      RunStatus.DONE,
        completedAt: new Date(),
        resultJson:  result as unknown as Prisma.InputJsonValue,
        warnings:    finalState.warnings,
      },
    });

    console.log("[optimize] run completed:", runId);
  } catch (err) {
    const msg = errorMessage(err);
    console.error("[optimize] graph invocation failed:", msg);

    // Mark the run as failed so the client stops polling
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
