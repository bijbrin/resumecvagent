"use client";

import { useState, useMemo, useCallback } from "react";
import { Loader2, Search, ExternalLink, MapPin, Building2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobTagChips } from "@/components/job-tag-chips";
import { JobDrawer } from "@/components/job-drawer";
import { normalizeUrl, type JobListing, type JobSource } from "@/lib/scraper/jobTags";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SourceResponse {
  source: JobSource;
  jobs: JobListing[];
  error: string | null;
  scrapedAt: string;
}

type SourceStatus = "loading" | "done" | "error";

interface SourceState {
  status: SourceStatus;
  jobs: JobListing[];
  error: string | null;
}

// Fetch + display order: fast LinkedIn (guest list, ~1s) first so it renders
// instantly, slowest Firecrawl board (SEEK) last.
const SOURCE_ORDER: JobSource[] = ["linkedin", "adzuna", "jora", "other", "indeed", "seek"];

const SOURCE_COLORS: Record<JobSource, string> = {
  seek: "#14b8a6", // teal
  jora: "#f97316", // orange
  indeed: "#2557a7", // indeed blue
  adzuna: "#16a34a", // green
  linkedin: "#2563eb", // linkedin blue
  other: "#8b5cf6", // violet
};

const SOURCE_LABELS: Record<JobSource, string> = {
  seek: "SEEK",
  jora: "Jora",
  indeed: "Indeed",
  adzuna: "Adzuna",
  linkedin: "LinkedIn",
  other: "Other",
};

// ── JobCard ───────────────────────────────────────────────────────────────────

function JobCard({ job, onOpen }: { job: JobListing; onOpen: () => void }) {
  const accentColor = SOURCE_COLORS[job.source];

  return (
    <button
      onClick={onOpen}
      className="relative flex flex-col gap-3 rounded-xl border p-4 text-left overflow-hidden transition-shadow hover:shadow-lg focus:outline-none focus:ring-2"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      {/* Header row: tags + posted */}
      <div className="flex items-start justify-between gap-2">
        <JobTagChips tags={job.tags} maxTech={3} />
        {job.postedAt && (
          <span
            className="shrink-0 text-[10px] font-mono flex items-center gap-1"
            style={{ color: "var(--text-faint)" }}
          >
            <Clock className="size-3" />
            {job.postedAt}
          </span>
        )}
      </div>

      {/* Title + company */}
      <div>
        <h3
          className="text-sm font-semibold leading-snug line-clamp-2"
          style={{ color: "var(--text-primary)" }}
        >
          {job.title}
        </h3>
        <div
          className="mt-1 flex flex-wrap items-center gap-3 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          {job.company && (
            <span className="flex items-center gap-1">
              <Building2 className="size-3 shrink-0" />
              {job.company}
            </span>
          )}
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3 shrink-0" />
              {job.location}
            </span>
          )}
        </div>
      </div>

      {job.salary && (
        <p className="text-xs font-semibold" style={{ color: "var(--accent-primary)" }}>
          {job.salary}
        </p>
      )}

      {job.summary && (
        <p
          className="text-xs leading-relaxed line-clamp-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {job.summary}
        </p>
      )}

      {/* Footer */}
      <div
        className="mt-auto flex items-center justify-between border-t pt-2"
        style={{ borderColor: "var(--border-default)" }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: accentColor }}
        >
          {SOURCE_LABELS[job.source]}
        </span>
        <span
          className="flex items-center gap-1 text-[11px] font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          View details
          <ExternalLink className="size-3" />
        </span>
      </div>
    </button>
  );
}

// ── Skeleton (loading placeholder) ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4 animate-pulse"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
    >
      <div className="h-3 w-24 rounded" style={{ background: "var(--bg-surface-2)" }} />
      <div className="h-4 w-3/4 rounded" style={{ background: "var(--bg-surface-2)" }} />
      <div className="h-3 w-1/2 rounded" style={{ background: "var(--bg-surface-2)" }} />
      <div className="h-3 w-2/3 rounded" style={{ background: "var(--bg-surface-2)" }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JobScraperPage() {
  const [sources, setSources] = useState<Record<JobSource, SourceState> | null>(null);
  const [filter, setFilter] = useState<JobSource | "all">("all");
  const [openJob, setOpenJob] = useState<JobListing | null>(null);

  const scanning = !!sources && SOURCE_ORDER.some((s) => sources[s].status === "loading");

  const handleScrape = useCallback(async () => {
    setFilter("all");
    const init = {} as Record<JobSource, SourceState>;
    for (const s of SOURCE_ORDER) init[s] = { status: "loading", jobs: [], error: null };
    setSources(init);

    // Fire one request per source; each updates its own slot as it resolves, so
    // the fast LinkedIn list appears first and the slow boards stream in.
    await Promise.all(
      SOURCE_ORDER.map(async (s) => {
        try {
          const res = await fetch(`/api/job-scraper?source=${s}`);
          const json = (await res.json()) as SourceResponse & { error?: string };
          if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
          setSources((prev) =>
            prev ? { ...prev, [s]: { status: "done", jobs: json.jobs ?? [], error: json.error ?? null } } : prev,
          );
        } catch (e) {
          setSources((prev) =>
            prev
              ? { ...prev, [s]: { status: "error", jobs: [], error: e instanceof Error ? e.message : "Failed" } }
              : prev,
          );
        }
      }),
    );
  }, []);

  // Combined, deduped jobs, in source (fast → slow) order.
  const allJobs = useMemo(() => {
    if (!sources) return [];
    const seen = new Set<string>();
    const out: JobListing[] = [];
    for (const s of SOURCE_ORDER) {
      for (const job of sources[s].jobs) {
        const k = normalizeUrl(job.url);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(job);
      }
    }
    return out;
  }, [sources]);

  const filtered = filter === "all" ? allJobs : allJobs.filter((j) => j.source === filter);
  const total = allJobs.length;

  // How many skeleton placeholders to show in the current view.
  const skeletonCount = !sources
    ? 0
    : filter === "all"
      ? SOURCE_ORDER.filter((s) => sources[s].status === "loading").length
      : sources[filter].status === "loading"
        ? 2
        : 0;

  const sourceErrors = sources
    ? SOURCE_ORDER.filter((s) => sources[s].status === "done" && sources[s].error).map(
        (s) => [s, sources[s].error] as [JobSource, string],
      )
    : [];

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Job Board Scanner
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Scans SEEK, Jora, Indeed, Adzuna and other boards (Glassdoor, Wellfound, Hays)
          via Firecrawl, plus LinkedIn (list only), for recent Australian IT &amp; software
          roles — ~20 tagged jobs. Results stream in as each board finishes; click any job
          to read the description and optimize your resume for it.
        </p>
      </div>

      {/* Scan button + summary */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Button
          onClick={handleScrape}
          disabled={scanning}
          className="gap-2 shadow-[0_8px_24px_-6px_rgba(104,67,236,0.55)]"
          style={{ background: "var(--accent-gradient)", color: "var(--text-on-accent)" }}
        >
          {scanning ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <Search className="size-4" />
              Scan Jobs Now
            </>
          )}
        </Button>

        {sources && (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {total}
            </span>{" "}
            job{total !== 1 ? "s" : ""}
            {scanning && (
              <span style={{ color: "var(--text-faint)" }}> · more loading…</span>
            )}
          </p>
        )}
      </div>

      {/* Results */}
      {sources && (
        <>
          {/* Source filter pills (live status per source) */}
          <div className="mb-5 flex flex-wrap gap-2">
            <FilterPill
              label="All"
              count={total}
              loading={scanning}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            {SOURCE_ORDER.map((s) => (
              <FilterPill
                key={s}
                label={SOURCE_LABELS[s]}
                count={sources[s].jobs.length}
                loading={sources[s].status === "loading"}
                active={filter === s}
                onClick={() => setFilter(s)}
              />
            ))}
          </div>

          {/* Per-source error notices (only for finished sources) */}
          {sourceErrors.map(([src, e]) => (
            <p key={src} className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
              {SOURCE_LABELS[src]}: {e}
            </p>
          ))}

          {filtered.length === 0 && skeletonCount === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No jobs to show. Try a different source or re-scan.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filtered.map((job, i) => (
                <JobCard key={`${job.url}-${i}`} job={job} onOpen={() => setOpenJob(job)} />
              ))}
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <SkeletonCard key={`skeleton-${i}`} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail drawer — keyed per job so its state resets cleanly */}
      {openJob && (
        <JobDrawer key={openJob.url} job={openJob} onClose={() => setOpenJob(null)} />
      )}
    </div>
  );
}

// ── Filter pill ────────────────────────────────────────────────────────────────

function FilterPill({
  label,
  count,
  loading,
  active,
  onClick,
}: {
  label: string;
  count: number;
  loading: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
      style={{
        background: active ? "var(--accent-primary)" : "var(--bg-surface)",
        color: active ? "var(--text-on-accent)" : "var(--text-secondary)",
        borderColor: active ? "var(--accent-primary)" : "var(--border-default)",
      }}
    >
      {label}
      {loading ? <Loader2 className="size-3 animate-spin" /> : <span>· {count}</span>}
    </button>
  );
}
