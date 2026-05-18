import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/resume/user";
import { ResumeSource } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";

const SaveTextSchema = z.object({
  name:    z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(50, "Resume must be at least 50 characters"),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resumes = await prisma.resume.findMany({
    where:   { userId },
    select:  { id: true, name: true, source: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ resumes });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const parsed = SaveTextSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: z.prettifyError(parsed.error) },
      { status: 422 },
    );
  }

  await ensureUser(userId);

  const name = parsed.data.name?.trim() || `Pasted ${new Date().toISOString().slice(0, 10)}`;
  const resume = await prisma.resume.create({
    data: {
      userId,
      name,
      source:  ResumeSource.TEXT,
      content: parsed.data.content,
    },
    select: { id: true, name: true, source: true, createdAt: true, content: true },
  });
  return NextResponse.json({ resume }, { status: 201 });
}
