import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/resume/user";
import { extractResumeText, MAX_RESUME_BYTES } from "@/lib/resume/extract";
import { ResumeSource } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: "Invalid form payload" }, { status: 400 }); }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_RESUME_BYTES) {
    return NextResponse.json({ error: "File too large — max 5 MB." }, { status: 413 });
  }

  let extracted: Awaited<ReturnType<typeof extractResumeText>>;
  try {
    extracted = await extractResumeText(file);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 422 });
  }

  await ensureUser(userId);

  const resume = await prisma.resume.create({
    data: {
      userId,
      name:    file.name || `resume.${extracted.source.toLowerCase()}`,
      source:  extracted.source === "PDF" ? ResumeSource.PDF : ResumeSource.DOCX,
      content: extracted.text,
    },
    select: { id: true, name: true, source: true, createdAt: true, content: true },
  });

  return NextResponse.json({ resume }, { status: 201 });
}
