import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { readApplicationContent } from "@/lib/sync/readContent";
import { buildCoverLetterPdf } from "@/lib/pdf/markdownPdf";

export const runtime = "nodejs";

function safeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "CoverLetter";
}

/**
 * Generate a styled CoverLetter.pdf on the fly from the folder's CoverLetter.md.
 * `?download=1` → attachment; otherwise inline (so the in-app viewer can embed it).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const app = await prisma.jobApplication.findUnique({ where: { id } });
  if (!app || app.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { coverLetter } = await readApplicationContent(app.folderPath);
  if (!coverLetter || coverLetter.trim().length === 0) {
    return NextResponse.json(
      { error: "No CoverLetter.md in this folder yet — run the agents to generate one." },
      { status: 404 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = await buildCoverLetterPdf(coverLetter);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[cover-letter.pdf] generation failed:", detail);
    return NextResponse.json({ error: "Failed to render .pdf", detail }, { status: 500 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  const fileName = safeFileName(`${app.company}_CoverLetter`) + ".pdf";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
