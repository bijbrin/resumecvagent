import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readApplicationContent } from "@/lib/sync/readContent";
import { getApplicationInsights } from "@/lib/applications/runInsights";
import { readChat, appendChat, type ChatMessage } from "@/lib/sync/chat";
import { chatComplete } from "@/lib/llm/anthropic";
import { csrfCheck } from "@/lib/csrf";

export const runtime = "nodejs";

const PostSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty").max(8_000),
});

async function ownedApplication(userId: string, id: string) {
  const app = await prisma.jobApplication.findUnique({ where: { id } });
  return app && app.userId === userId ? app : null;
}

/**
 * Build the grounding system prompt from everything we know about the
 * application: metadata, the on-disk documents, and the structured insights
 * from the latest optimization run. Long documents are truncated so a big JD
 * can't blow the context budget.
 */
function buildSystemPrompt(
  app: { company: string; role: string | null; location: string | null; salary: string | null },
  content: Awaited<ReturnType<typeof readApplicationContent>>,
  insights: Awaited<ReturnType<typeof getApplicationInsights>>,
): string {
  const clip = (s: string | null, max = 6_000) =>
    s ? (s.length > max ? `${s.slice(0, max)}\n…(truncated)` : s) : "(none)";

  const role = [app.company, app.role].filter(Boolean).join(" — ");
  const fit = insights.fitScore !== null ? `${insights.fitScore}/100` : "unknown";
  const jd = insights.jobDetails;
  const roleFacts = jd
    ? [
        jd.requiredSkills.length ? `Required skills: ${jd.requiredSkills.join(", ")}` : null,
        jd.preferredSkills.length ? `Preferred skills: ${jd.preferredSkills.join(", ")}` : null,
        jd.keywords.length ? `ATS keywords: ${jd.keywords.join(", ")}` : null,
        jd.securityClearance ? `Security clearance: ${jd.securityClearance}` : null,
        jd.citizenshipRequired ? `Citizenship: ${jd.citizenshipRequired}` : null,
      ].filter(Boolean).join("\n")
    : "";

  return [
    "You are a career assistant embedded in a job-application workspace. You help the candidate understand and improve THIS specific application — answering questions, drafting tailored bullet points, prepping interview answers, and flagging gaps against the role.",
    "Be concise, concrete, and honest about gaps. When you reference the resume or JD, ground your answer in the content below rather than inventing facts. If the candidate asks for a rewrite, return ready-to-paste markdown.",
    "",
    `# Application\nCompany/Role: ${role || "(unknown)"}\nLocation: ${app.location ?? "n/a"} · Salary: ${app.salary ?? "n/a"} · Fit score: ${fit}`,
    roleFacts ? `\n# What matters for this role\n${roleFacts}` : "",
    `\n# Job Description\n${clip(content.jd)}`,
    `\n# Tailored Resume\n${clip(content.resume)}`,
    `\n# Cover Letter\n${clip(content.coverLetter)}`,
    `\n# Recruiter Review\n${clip(content.review, 3_000)}`,
    `\n# Optimization Report\n${clip(content.report, 3_000)}`,
    `\n# Interview Prep\n${clip(content.interview, 3_000)}`,
  ].filter(Boolean).join("\n");
}

/** Return the persisted chat transcript. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const app = await ownedApplication(userId, id);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ messages: readChat(app.folderPath) });
}

/** Send a user message, get a grounded reply, and persist both to Chat.md. */
export async function POST(
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

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: z.prettifyError(parsed.error) },
      { status: 422 },
    );
  }
  const { message } = parsed.data;

  try {
    const [content, insights] = await Promise.all([
      readApplicationContent(app.folderPath),
      getApplicationInsights(app.id, userId),
    ]);

    const history = readChat(app.folderPath);
    const userMsg: ChatMessage = { role: "user", content: message };
    const system = buildSystemPrompt(app, content, insights);
    const reply = await chatComplete([...history, userMsg], system);

    const assistantMsg: ChatMessage = { role: "assistant", content: reply };
    appendChat(app.folderPath, [userMsg, assistantMsg]);

    return NextResponse.json({ reply: assistantMsg });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[applications/chat] failed:", detail);
    return NextResponse.json({ error: "Chat failed", detail }, { status: 500 });
  }
}
