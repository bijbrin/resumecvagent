import "server-only";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/resume/user";
import { importApplication } from "@/lib/sync/importApplication";
import { startApplicationRun, StartRunError } from "@/lib/applications/startRun";
import { FILES, getWorkspaceRoot, jobFolderPath } from "@/lib/sync/paths";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  url: z.string().regex(/^https?:\/\//, "A valid job URL is required"),
  title: z.string().min(1).optional().default(""),
  company: z.string().optional().default(""),
  location: z.string().optional().default(""),
  salary: z.string().optional().default(""),
  jobDescription: z.string().min(1, "A job description is required"),
});

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "job"
  );
}

/** Pick a folder slug that doesn't collide on disk or in the DB. */
async function uniqueSlug(userId: string, base: string): Promise<string> {
  const root = getWorkspaceRoot();
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const onDisk = existsSync(jobFolderPath(slug, root));
    const inDb = await prisma.jobApplication.findUnique({
      where: { userId_slug: { userId, slug } },
      select: { id: true },
    });
    if (!onDisk && !inDb) return slug;
  }
  return `${base}-${Date.now()}`;
}

function buildJdMarkdown(data: z.infer<typeof BodySchema>): string {
  const header = [
    data.title && `# ${data.title}`,
    data.company && `**Company:** ${data.company}`,
    data.location && `**Location:** ${data.location}`,
    data.salary && `**Salary:** ${data.salary}`,
    `**Source:** ${data.url}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return `${header}\n\n---\n\n${data.jobDescription.trim()}\n`;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  await ensureUser(userId);

  // 1. Materialise the job folder with a JD.md (folder is the source of truth).
  const base = slugify(data.company || data.title || "job");
  const slug = await uniqueSlug(userId, base);
  const folderPath = jobFolderPath(slug);
  mkdirSync(folderPath, { recursive: true });
  writeFileSync(path.join(folderPath, FILES.jd), buildJdMarkdown(data), "utf8");

  // 2. Import the folder → DB row, then stamp the metadata we already know.
  const imported = await importApplication(prisma, userId, { slug, path: folderPath });
  const app = await prisma.jobApplication.update({
    where: { id: imported.id },
    data: {
      jobUrl: data.url,
      ...(data.company ? { company: data.company } : {}),
      ...(data.title ? { role: data.title } : {}),
      ...(data.location ? { location: data.location } : {}),
      ...(data.salary ? { salary: data.salary } : {}),
    },
  });

  // 3. Kick off the agent graph (resume seeds from master MyResume.md).
  try {
    const run = await startApplicationRun(app);
    return NextResponse.json(
      { id: app.id, slug, correlationId: run.correlationId, status: run.status },
      { status: 202 },
    );
  } catch (err) {
    if (err instanceof StartRunError) {
      // The application + folder still exist — surface the id so the UI can
      // navigate there and the user can fix inputs / retry from the detail page.
      return NextResponse.json(
        { id: app.id, slug, error: err.message },
        { status: err.statusCode },
      );
    }
    throw err;
  }
}
