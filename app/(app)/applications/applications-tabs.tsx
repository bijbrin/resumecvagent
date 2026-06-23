"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MapPin, Banknote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  statusStyle,
} from "@/lib/applications/status";
import type { AppRow } from "./page";

const ALL = "all";

const TABS = [
  { value: ALL, label: "All" },
  ...APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

function ApplicationCard({ app }: { app: AppRow }) {
  return (
    <Link href={`/applications/${app.id}`}>
      <div
        className="rounded-lg border px-4 py-3 flex flex-col gap-2 hover:border-[var(--accent-primary)] transition-colors"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
            {app.company}
          </p>
          <Badge variant="outline" className="text-[10px] font-semibold px-1.5 shrink-0" style={statusStyle(app.status)}>
            {STATUS_LABELS[app.status as keyof typeof STATUS_LABELS] ?? app.status}
          </Badge>
        </div>
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

export function ApplicationsTabs({ applications }: { applications: AppRow[] }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    m.set(ALL, applications.length);
    for (const s of APPLICATION_STATUSES) {
      m.set(s, applications.filter((a) => a.status === s).length);
    }
    return m;
  }, [applications]);

  const grouped = useMemo(() => {
    const m = new Map<string, AppRow[]>();
    m.set(ALL, applications);
    for (const s of APPLICATION_STATUSES) {
      m.set(s, applications.filter((a) => a.status === s));
    }
    return m;
  }, [applications]);

  return (
    <Tabs defaultValue={ALL}>
      <style>{`
        .accent-underline[data-active]::after { background: var(--accent-primary) !important; }
        .accent-underline[data-active] { color: var(--accent-primary); }
      `}</style>
      <TabsList variant="line" className="mb-6 flex-wrap h-auto gap-0 border-b" style={{ borderColor: "var(--border-default)" }}>
        {TABS.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="accent-underline gap-1.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {t.label}
            <span className="text-[11px] opacity-60">({counts.get(t.value)})</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {TABS.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {(grouped.get(t.value) ?? []).length === 0 ? (
            <div
              className="rounded-lg border border-dashed py-12 text-center"
              style={{ borderColor: "var(--border-default)" }}
            >
              <p className="text-sm text-muted-foreground">
                No {t.label.toLowerCase()} applications.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
              {(grouped.get(t.value) ?? []).map((app) => (
                <ApplicationCard key={app.id} app={app} />
              ))}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
