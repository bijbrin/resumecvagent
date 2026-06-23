import { NextRequest, NextResponse, after } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createInitialState } from "@/lib/state/resumeState";
import { runGraphInBackground } from "@/lib/graph/runOptimization";
import { promoteOptimizationRunToApplication } from "@/lib/applications/promoteRun";
import { RunStatus, ResumeSource } from "@/lib/generated/prisma/client";
import { safeErrorDetail } from "@/lib/errors";
import { csrfCheck } from "@/lib/csrf";

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
  // When the client sends a resumeId, the resumeText came from an already-saved
  // resume — skip auto-save to avoid duplicating history rows.
  resumeId:           z.string().optional(),
});

// Serialise any thrown value to a readable string for logging.
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

export async function POST(req: NextRequest) {
  const csrfError = csrfCheck(req);
  if (csrfError) return csrfError;

  // ── Top-level guard — ensures every failure path returns JSON ─────────────
  try {
    return await handleOptimize(req);
  } catch (err) {
    console.error("[optimize] unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: safeErrorDetail(err) },
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
      { error: "Database error — check DATABASE_URL and run prisma db push.", detail: safeErrorDetail(err) },
      { status: 503 },
    );
  }

  // ── Auto-save pasted resume to history ────────────────────────────────────
  // Only when the client did not pass an existing resumeId. Best-effort —
  // history is a nice-to-have, must not block the run.
  if (!data.resumeId) {
    try {
      await prisma.resume.create({
        data: {
          userId,
          name:    `Pasted ${new Date().toISOString().slice(0, 10)}`,
          source:  ResumeSource.TEXT,
          content: data.resumeText,
        },
      });
    } catch (err) {
      console.warn("[optimize] auto-save resume failed (non-fatal):", errorMessage(err));
    }
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
      { error: "Database error — could not create optimization run.", detail: safeErrorDetail(err) },
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
    await runGraphInBackground(run.id, initialState, {
      // Content lives in the promoted job folder, not Postgres — keep PII out
      // of the DB. The promote step writes only PII-safe insights to resultJson.
      persistResultJson: false,
      onDone: async (result) => {
        await promoteOptimizationRunToApplication({
          userId,
          runId:         run.id,
          correlationId,
          jobUrl:             data.jobUrl,
          companyName:        data.companyName || null,
          jobDescriptionText: data.jobDescriptionText || null,
          result,
        });
      },
    });
  });

  return NextResponse.json(
    { correlationId, status: "RUNNING" },
    { status: 202 },
  );
}
