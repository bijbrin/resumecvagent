import { NextResponse } from "next/server";
import { requireAuthUserId, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** List the signed-in user's tracked job applications (metadata only). */
export async function GET() {
  let userId: string;
  try {
    userId = await requireAuthUserId();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const applications = await prisma.jobApplication.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true, slug: true, company: true, role: true, jobUrl: true,
      location: true, salary: true, status: true, appliedAt: true,
      deadline: true, updatedAt: true,
    },
  });

  return NextResponse.json({ applications });
}
