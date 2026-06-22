import Link from "next/link";
import { MapPin, Banknote } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { SyncButton } from "@/components/sync-button";
import {
  BOARD_COLUMNS,
  STATUS_LABELS,
  statusStyle,
  type ApplicationStatusValue,
} from "@/lib/applications/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AppRow = {
  id: string;
  slug: string;
  company: string;
  role: string | null;
  location: string | null;
  salary: string | null;
  status: string;
  updatedAt: Date;
};

function ApplicationCard({ app }: { app: AppRow }) {
  return (
    <Link href={`/applications/${app.id}`}>
      <div
        className="rounded-lg border px-4 py-3 flex flex-col gap-2 hover:border-[var(--accent-primary)] transition-colors"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
      >
        <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
          {app.company}
        </p>
        {app.role && (
          <p className="text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>
            {app.role}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {app.location && (
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-faint)" }}>
              <MapPin className="size-3 shrink-0" />
              {app.location}
            </span>
          )}
          {app.salary && (
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-faint)" }}>
              <Banknote className="size-3 shrink-0" />
              {app.salary}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

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

  const byStatus = new Map<ApplicationStatusValue, AppRow[]>();
  for (const col of BOARD_COLUMNS) byStatus.set(col, []);
  const archived: AppRow[] = [];
  for (const app of applications) {
    if (app.status === "ARCHIVED") { archived.push(app); continue; }
    const bucket = byStatus.get(app.status as ApplicationStatusValue);
    if (bucket) bucket.push(app);
    else byStatus.get("DRAFT")!.push(app);
  }

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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
          {BOARD_COLUMNS.map((col) => {
            const items = byStatus.get(col) ?? [];
            return (
              <div key={col} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-semibold px-2" style={statusStyle(col)}>
                    {STATUS_LABELS[col]}
                  </Badge>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>{items.length}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {items.map((app) => <ApplicationCard key={app.id} app={app} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <details className="mt-10">
          <summary className="text-sm cursor-pointer" style={{ color: "var(--text-faint)" }}>
            Archived ({archived.length})
          </summary>
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
            {archived.map((app) => <ApplicationCard key={app.id} app={app} />)}
          </div>
        </details>
      )}
    </div>
  );
}
