import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readApplicationContent } from "@/lib/sync/readContent";
import { getApplicationInsights } from "@/lib/applications/runInsights";
import { ApplicationDetail, type ApplicationMeta } from "@/components/application-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Application | ResumeCV Agent",
  description: "Edit the tailored resume and cover letter, review fit score and company research, and chat with the AI assistant for this application.",
  openGraph: {
    title: "Application | ResumeCV Agent",
    description: "Edit the tailored resume and cover letter, review fit score and company research, and chat with the AI assistant for this application.",
  },
};

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireAuth();
  const { id } = await params;

  let app;
  try {
    app = await prisma.jobApplication.findUnique({ where: { id, userId } });
  } catch (e) {
    console.error("DB fetch failed", e);
    notFound();
  }
  if (!app) notFound();

  const [content, insights] = await Promise.all([
    readApplicationContent(app.folderPath),
    getApplicationInsights(app.id, userId),
  ]);

  return (
    <div>
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <Link
          href="/applications"
          className="inline-flex items-center gap-1.5 text-sm hover:underline"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="size-4" /> Applications
        </Link>
      </div>
      <ApplicationDetail
        application={{
          id: app.id,
          slug: app.slug,
          company: app.company,
          role: app.role,
          jobUrl: app.jobUrl,
          location: app.location,
          salary: app.salary,
          status: app.status,
        } satisfies ApplicationMeta}
        content={content}
        insights={insights}
      />
    </div>
  );
}
