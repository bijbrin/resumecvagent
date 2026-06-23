"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_LABELS,
  statusStyle,
} from "@/lib/applications/status";

interface RecentApp {
  id: string;
  company: string;
  role: string | null;
  status: string;
  updatedAt: string;
}

/**
 * Compact "latest 5 applications" rail shown beneath the optimizer's pipeline
 * preview. Fetches from /api/applications (metadata only — no PII) and sorts
 * client-side by updatedAt desc. Replaces the legacy localStorage search
 * history: every optimizer run now promotes to a tracked application, so the
 * applications table IS the history.
 */
export function RecentApplications() {
  const [apps, setApps] = useState<RecentApp[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/applications")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { applications: RecentApp[] } | null) => {
        if (cancelled || !j?.applications) return;
        const recent = [...j.applications]
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5);
        setApps(recent);
      })
      .catch(() => { /* non-fatal — rail just stays hidden */ });
    return () => { cancelled = true; };
  }, []);

  // Still loading — render the container shell so layout doesn't jump.
  if (apps === null) {
    return <div className="w-full max-w-2xl" aria-hidden />;
  }

  if (apps.length === 0) return null;

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Recent applications
        </h2>
        <Link
          href="/applications"
          className="text-xs hover:underline"
          style={{ color: "var(--accent-primary)" }}
        >
          View all
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {apps.map((app) => (
          <Link key={app.id} href={`/applications/${app.id}`}>
            <div
              className="rounded-lg border px-4 py-3 flex items-center gap-3 hover:border-[var(--accent-primary)] transition-colors"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate leading-snug" style={{ color: "var(--text-primary)" }}>
                  {app.company}
                </p>
                {app.role && (
                  <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-faint)" }}>
                    {app.role}
                  </p>
                )}
              </div>
              <Badge
                variant="outline"
                className="text-xs font-semibold px-2 shrink-0"
                style={statusStyle(app.status)}
              >
                {STATUS_LABELS[app.status as keyof typeof STATUS_LABELS] ?? app.status}
              </Badge>
              <span className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>
                {new Date(app.updatedAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <ExternalLink className="size-3 shrink-0" style={{ color: "var(--text-faint)" }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
