import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { RunStatus } from "@/lib/generated/prisma/client";
import type { CompanyResearch, JobDetails } from "@/lib/state/resumeState";

export const runtime = "nodejs";

interface ResultPayload {
  optimizedResumeContent: string | null;
  optimizedCoverLetter:   string | null;
  interviewCheatsheet:    string | null;
  reportMarkdown:         string | null;
  fitScore:               number | null;
  warnings:               string[];
  companyResearch:        CompanyResearch | null;
  jobDetails:             JobDetails | null;
}

interface DoneResponse {
  correlationId: string;
  status:        "DONE";
  result:        ResultPayload;
}

interface RunningResponse {
  correlationId: string;
  status:        "RUNNING";
}

interface FailedResponse {
  correlationId: string;
  status:        "FAILED";
  error:         string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ correlationId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { correlationId } = await params;

  const run = await prisma.optimizationRun.findUnique({
    where: { correlationId },
    select: {
      id:         true,
      userId:     true,
      status:     true,
      resultJson: true,
      warnings:   true,
    },
  });

  if (!run || run.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (run.status === RunStatus.RUNNING) {
    const response: RunningResponse = { correlationId, status: "RUNNING" };
    return NextResponse.json(response, { status: 202 });
  }

  if (run.status === RunStatus.FAILED) {
    const response: FailedResponse = {
      correlationId,
      status: "FAILED",
      error:  run.warnings[run.warnings.length - 1] ?? "Optimization failed",
    };
    return NextResponse.json(response, { status: 500 });
  }

  // DONE (or PENDING — treat as done if resultJson exists)
  const result = (run.resultJson as unknown as ResultPayload | null) ?? {
    optimizedResumeContent: null,
    optimizedCoverLetter:   null,
    interviewCheatsheet:    null,
    reportMarkdown:         null,
    fitScore:               null,
    warnings:               run.warnings,
    companyResearch:        null,
    jobDetails:             null,
  };

  const response: DoneResponse = { correlationId, status: "DONE", result };
  return NextResponse.json(response);
}