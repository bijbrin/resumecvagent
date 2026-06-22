import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/resume/user";
import { exportAll, importAll } from "@/lib/sync/syncAll";

// Node.js runtime required: this route reads and writes the local filesystem.
export const runtime = "nodejs";

const BodySchema = z.object({
  mode: z.enum(["import", "export", "all"]).optional().default("all"),
});

/**
 * Only allow filesystem sync when running locally. The job folders live on the
 * developer's machine, so this is meaningless (and unsafe) in a deployed
 * environment. Guards on both NODE_ENV and a loopback Host header.
 */
function isLocalRequest(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const host = (req.headers.get("host") ?? "").toLowerCase();
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]") ||
    host.startsWith("0.0.0.0")
  );
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isLocalRequest(req)) {
    return NextResponse.json(
      { error: "Folder sync is only available when running the app locally." },
      { status: 403 },
    );
  }

  let body: unknown = {};
  try { body = await req.json(); } catch { /* empty body → defaults */ }
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: z.prettifyError(parsed.error) },
      { status: 422 },
    );
  }
  const { mode } = parsed.data;

  await ensureUser(userId);

  try {
    const imported = mode === "export" ? [] : await importAll(prisma, userId);
    const exported = mode === "import" ? [] : await exportAll(prisma, userId);
    return NextResponse.json({
      mode,
      imported: imported.map((r) => ({ slug: r.slug, action: r.action })),
      exported: exported.map((r) => ({ slug: r.slug, written: r.written })),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[sync] failed:", detail);
    return NextResponse.json({ error: "Sync failed", detail }, { status: 500 });
  }
}
