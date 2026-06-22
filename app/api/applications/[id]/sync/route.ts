import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { importApplication } from "@/lib/sync/importApplication";
import { exportApplication } from "@/lib/sync/exportApplication";

// Node.js runtime: reads and writes the local filesystem.
export const runtime = "nodejs";

/**
 * Folder sync only makes sense locally — the job folders live on the developer's
 * machine. Mirror the guard used by the global /api/sync route.
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

async function ownedApplication(userId: string, id: string) {
  const app = await prisma.jobApplication.findUnique({ where: { id } });
  return app && app.userId === userId ? app : null;
}

/**
 * Re-sync a single application with its folder: import (pick up manual edits to
 * the markdown files → refresh fileHashes) then export (rewrite the
 * application.yaml sidecar from the DB row). Keeps DB ⇄ folder in step without
 * a full-workspace sync.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isLocalRequest(req)) {
    return NextResponse.json(
      { error: "Folder sync is only available when running the app locally." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const app = await ownedApplication(userId, id);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await importApplication(prisma, userId, { slug: app.slug, path: app.folderPath });
    await exportApplication(prisma, id); // metadata-only — refreshes application.yaml
    return NextResponse.json({ ok: true, syncedAt: new Date().toISOString() });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[applications/sync] failed:", detail);
    return NextResponse.json({ error: "Sync failed", detail }, { status: 500 });
  }
}
