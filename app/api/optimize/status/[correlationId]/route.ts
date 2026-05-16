import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { type AgentStatusMap } from "@/lib/state/resumeState";
import { type RunStatus } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";

interface StatusResponse {
  correlationId: string;
  status:        RunStatus;
  agentStatus:   AgentStatusMap | null;
  warnings:      string[];
  createdAt:     string;
  completedAt:   string | null;
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
      id:            true,
      userId:        true,
      status:        true,
      agentStatusJson: true,
      warnings:      true,
      createdAt:     true,
      completedAt:   true,
    },
  });

  if (!run || run.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const response: StatusResponse = {
    correlationId,
    status:      run.status,
    agentStatus: (run.agentStatusJson as unknown as AgentStatusMap) ?? null,
    warnings:    run.warnings,
    createdAt:   run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };

  return NextResponse.json(response);
}