import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/resume/user";
import { startApplicationRun, StartRunError } from "@/lib/applications/startRun";

export const runtime = "nodejs";

/**
 * Re-run the agent pipeline on a tracked application using the markdown content
 * from its folder (no scraping — JD/resume/cover letter are fed in directly).
 * On completion the optimized artifacts are written back to the folder; PII is
 * NOT persisted to Postgres. See `lib/applications/startRun.ts`.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const app = await prisma.jobApplication.findUnique({ where: { id } });
  if (!app || app.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await ensureUser(userId);

  try {
    const result = await startApplicationRun(app);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof StartRunError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}
