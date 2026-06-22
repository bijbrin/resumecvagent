import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exportApplication } from "@/lib/sync/exportApplication";

export const runtime = "nodejs";

const PutSchema = z.object({
  kind:    z.enum(["resume", "coverLetter"]),
  content: z.string().min(1, "Content cannot be empty").max(100_000),
});

async function ownedApplication(userId: string, id: string) {
  const app = await prisma.jobApplication.findUnique({ where: { id } });
  return app && app.userId === userId ? app : null;
}

/**
 * Save edited Resume.md / CoverLetter.md back to the job folder. Reuses
 * exportApplication so the on-disk artifacts (Resume.docx), file hashes, and
 * application.yaml sidecar stay in step. The .docx / .pdf download routes read
 * the file on each request, so they reflect the new content immediately.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const app = await ownedApplication(userId, id);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: z.prettifyError(parsed.error) },
      { status: 422 },
    );
  }
  const { kind, content } = parsed.data;

  try {
    await exportApplication(
      prisma,
      id,
      kind === "resume" ? { resume: content } : { coverLetter: content },
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[applications/content] save failed:", detail);
    return NextResponse.json({ error: "Failed to save content", detail }, { status: 500 });
  }

  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
