import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SyncButton } from "@/components/sync-button";
import { ApplicationsTabs } from "./applications-tabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Applications | ResumeCV Agent",
  description: "Track every job application's status, fit score, and tailored documents in one board.",
  openGraph: {
    title: "Applications | ResumeCV Agent",
    description: "Track every job application's status, fit score, and tailored documents in one board.",
  },
};

export type AppRow = {
  id: string;
  slug: string;
  company: string;
  role: string | null;
  location: string | null;
  salary: string | null;
  status: string;
  updatedAt: Date;
};

export default async function ApplicationsPage() {
  const userId = await requireAuth();

  const applications: AppRow[] = await prisma.jobApplication.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, slug: true, company: true, role: true,
      location: true, salary: true, status: true, updatedAt: true,
    },
  });

  return (
    <div className="max-w-[1400px] mx-auto py-10 px-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Applications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every job folder, tracked by stage. Edit markdown in the folder or here, then sync.
          </p>
        </div>
        <SyncButton />
      </div>

      {applications.length === 0 ? (
        <div
          className="rounded-lg border border-dashed py-16 text-center"
          style={{ borderColor: "var(--border-default)" }}
        >
          <p className="text-sm text-muted-foreground">No applications yet.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Add a job folder under the workspace, then click{" "}
            <span style={{ color: "var(--text-secondary)" }}>Sync folders</span>.
          </p>
        </div>
      ) : (
        <ApplicationsTabs applications={applications} />
      )}
    </div>
  );
}
