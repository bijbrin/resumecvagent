import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readApplicationContent } from "@/lib/sync/readContent";
import { exportApplication } from "@/lib/sync/exportApplication";
import { ApplicationStatus, Prisma } from "@/lib/generated/prisma/client";
import { csrfCheck } from "@/lib/csrf";

export const runtime = "nodejs";

const PatchSchema = z.object({
  status:       z.nativeEnum(ApplicationStatus).optional(),
  company:      z.string().trim().min(1).max(200).optional(),
  role:         z.string().trim().max(200).nullable().optional(),
  jobUrl:       z.string().trim().max(500).nullable().optional(),
  location:     z.string().trim().max(200).nullable().optional(),
  salary:       z.string().trim().max(100).nullable().optional(),
  appliedAt:    z.string().datetime().nullable().optional(),
  deadline:     z.string().datetime().nullable().optional(),
  contactName:  z.string().trim().max(200).nullable().optional(),
  contactEmail: z.string().trim().max(200).nullable().optional(),
  notes:        z.string().max(5000).nullable().optional(),
});

async function ownedApplication(userId: string, id: string) {
  return prisma.jobApplication.findUnique({ where: { id, userId } });
}

/** Application metadata (DB) + current markdown bodies (read from the folder). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const app = await ownedApplication(userId, id);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const content = await readApplicationContent(app.folderPath);
  return NextResponse.json({ application: app, content });
}

/** Update tracking metadata, then refresh the folder's application.yaml. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = csrfCheck(req);
  if (csrfError) return csrfError;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const app = await ownedApplication(userId, id);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: z.prettifyError(parsed.error) },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const data: Prisma.JobApplicationUpdateInput = {
    ...(d.status       !== undefined && { status: d.status }),
    ...(d.company      !== undefined && { company: d.company }),
    ...(d.role         !== undefined && { role: d.role }),
    ...(d.jobUrl       !== undefined && { jobUrl: d.jobUrl }),
    ...(d.location     !== undefined && { location: d.location }),
    ...(d.salary       !== undefined && { salary: d.salary }),
    ...(d.appliedAt    !== undefined && { appliedAt: d.appliedAt ? new Date(d.appliedAt) : null }),
    ...(d.deadline     !== undefined && { deadline: d.deadline ? new Date(d.deadline) : null }),
    ...(d.contactName  !== undefined && { contactName: d.contactName }),
    ...(d.contactEmail !== undefined && { contactEmail: d.contactEmail }),
    ...(d.notes        !== undefined && { notes: d.notes }),
  };

  // Scope the WHERE by userId too, not just id — without it, ownedApplication's
  // check above and this write aren't atomic, so a row transferred between the
  // check and the update could be modified by the wrong user.
  const updated = await prisma.jobApplication.update({ where: { id, userId }, data });

  // Keep the on-disk sidecar in step with the DB (metadata-only export).
  try {
    await exportApplication(prisma, id);
  } catch (err) {
    console.warn("[applications] sidecar export after PATCH failed (non-fatal):",
      err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ application: updated });
}
