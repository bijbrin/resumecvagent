"use client";

import { useState } from "react";
import { Loader2, Search, ExternalLink, Shield, Flag, MapPin, Building2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JobListing {
  title: string;
  company: string;
  location: string;
  url: string;
  postedAt: string;
  source: "linkedin" | "seek" | "jora";
  workType?: string;
  workArrangement?: string;
  salary?: string;
  description?: string;
  bulletPoints?: string[];
  requiresClearance: boolean;
  requiresCitizenship: boolean;
}

interface ScrapeResult {
  results: {
    seek:     JobListing[];
    jora:     JobListing[];
    linkedin: JobListing[];
  };
  errors: {
    seek:     string | null;
    jora:     string | null;
    linkedin: string | null;
  };
  scrapedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<JobListing["source"], string> = {
  seek:     "#14b8a6", // teal
  jora:     "#f97316", // orange
  linkedin: "#2563eb", // blue
};

const ARRANGEMENT_COLORS: Record<string, string> = {
  Remote:   "color-mix(in srgb, #16a34a 12%, transparent)",
  Hybrid:   "color-mix(in srgb, #2563eb 10%, transparent)",
  "On-site":"color-mix(in srgb, #6b7280 10%, transparent)",
};
const ARRANGEMENT_TEXT: Record<string, string> = {
  Remote:   "#15803d",
  Hybrid:   "#1d4ed8",
  "On-site":"#374151",
};

// ── JobCard ───────────────────────────────────────────────────────────────────

function JobCard({ job }: { job: JobListing }) {
  const accentColor = SOURCE_COLORS[job.source];

  return (
    <div
      className="relative flex flex-col gap-3 rounded-xl border p-4 overflow-hidden"
      style={{
        background:   "var(--bg-surface)",
        borderColor:  "var(--border-default)",
        borderLeft:   `3px solid ${accentColor}`,
      }}
    >
      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {job.workType && (
            <span
              className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border"
              style={{
                background:  "var(--bg-surface-2, #f3f3f5)",
                borderColor: "var(--border-default)",
                color:       "var(--text-secondary)",
              }}
            >
              {job.workType}
            </span>
          )}
          {job.workArrangement && (
            <span
              className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border"
              style={{
                background:  ARRANGEMENT_COLORS[job.workArrangement] ?? "var(--bg-surface-2)",
                borderColor: "transparent",
                color:       ARRANGEMENT_TEXT[job.workArrangement] ?? "var(--text-secondary)",
              }}
            >
              {job.workArrangement}
            </span>
          )}
        </div>

        <span
          className="shrink-0 text-[10px] font-mono flex items-center gap-1"
          style={{ color: "var(--text-faint)" }}
        >
          <Clock className="size-3" />
          {job.postedAt}
        </span>
      </div>

      {/* ── Title ── */}
      <div>
        <h3
          className="text-sm font-semibold leading-snug line-clamp-2"
          style={{ color: "var(--text-primary)" }}
        >
          {job.title}
        </h3>
        <div
          className="flex items-center gap-3 mt-1 text-xs flex-wrap"
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

      {/* ── Salary ── */}
      {job.salary && (
        <p
          className="text-xs font-semibold"
          style={{ color: "var(--accent-primary)" }}
        >
          {job.salary}
        </p>
      )}

      {/* ── Bullet points / description ── */}
      {(job.bulletPoints?.length ?? 0) > 0 ? (
        <ul className="flex flex-col gap-1">
          {job.bulletPoints!.map((bp, i) => (
            <li
              key={i}
              className="flex items-start gap-1.5 text-xs leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              <span className="mt-1 size-1 rounded-full shrink-0 bg-current opacity-50" />
              <span className="line-clamp-2">{bp}</span>
            </li>
          ))}
        </ul>
      ) : job.description ? (
        <p
          className="text-xs leading-relaxed line-clamp-3"
          style={{ color: "var(--text-secondary)" }}
        >
          {job.description}
        </p>
      ) : null}

      {/* ── Requirement tags ── */}
      {(job.requiresClearance || job.requiresCitizenship) && (
        <div className="flex flex-wrap gap-1.5">
          {job.requiresClearance && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
              style={{
                background:  "color-mix(in srgb, #dc2626 10%, transparent)",
                borderColor: "color-mix(in srgb, #dc2626 30%, transparent)",
                color:       "#b91c1c",
              }}
            >
              <Shield className="size-2.5" />
              Clearance required
            </span>
          )}
          {job.requiresCitizenship && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
              style={{
                background:  "color-mix(in srgb, #2563eb 8%, transparent)",
                borderColor: "color-mix(in srgb, #2563eb 25%, transparent)",
                color:       "#1d4ed8",
              }}
            >
              <Flag className="size-2.5" />
              AU citizen / PR
            </span>
          )}
        </div>
      )}

      {/* ── Footer: source badge + open button ── */}
      <div className="flex items-center justify-between pt-1 mt-auto border-t" style={{ borderColor: "var(--border-default)" }}>
        <span
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: accentColor }}
        >
          {job.source === "jora" ? "Jora / Indeed" : job.source === "seek" ? "SEEK" : "LinkedIn"}
        </span>

        {job.url && (
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 h-7 px-2.5 text-xs"
              style={{
                borderColor: "var(--border-default)",
                color:       "var(--text-secondary)",
              }}
            >
              <ExternalLink className="size-3" />
              Apply
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

// ── SourceGrid ────────────────────────────────────────────────────────────────

function SourceGrid({
  jobs,
  error,
  source,
}: {
  jobs: JobListing[];
  error: string | null;
  source: string;
}) {
  if (error) {
    return (
      <p className="py-10 text-center text-sm" style={{ color: "var(--state-error)" }}>
        Failed to scrape {source}: {error}
      </p>
    );
  }
  if (jobs.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No recent jobs found from {source}.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {jobs.map((job, i) => (
        <JobCard key={`${job.url}-${i}`} job={job} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JobScraperPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [data, setData] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScrape() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/job-scraper");
      if (!res.ok) {
        setError(`Server error ${res.status}`);
        setStatus("error");
        return;
      }
      const json = (await res.json()) as ScrapeResult;
      setData(json);
      setStatus("done");
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  }

  const total = data
    ? data.results.seek.length + data.results.jora.length + data.results.linkedin.length
    : 0;

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Job Board Scanner
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Scans SEEK, Jora (includes Indeed listings), and LinkedIn for Australian
          IT &amp; software jobs posted in the last 24 hours.
        </p>
      </div>

      {/* ── Scan button + summary ── */}
      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <Button
          onClick={handleScrape}
          disabled={status === "loading"}
          className="gap-2"
          style={{ background: "var(--accent-primary)", color: "#fff" }}
        >
          {status === "loading" ? (
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

        {status === "done" && data && (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Found{" "}
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {total}
            </span>{" "}
            job{total !== 1 ? "s" : ""}{" "}
            <span style={{ color: "var(--text-faint)" }}>
              · {new Date(data.scrapedAt).toLocaleTimeString("en-AU")}
            </span>
          </p>
        )}
      </div>

      {/* ── Error banner ── */}
      {status === "error" && error && (
        <div
          className="rounded-lg border px-4 py-3 text-sm mb-6"
          style={{
            background:  "color-mix(in srgb, var(--state-error) 10%, transparent)",
            borderColor: "var(--state-error)",
            color:       "var(--state-error)",
          }}
        >
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {status === "done" && data && (
        <Tabs defaultValue="seek" className="w-full">
          <TabsList className="mb-5">
            <TabsTrigger value="seek" className="gap-1.5">
              SEEK
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {data.results.seek.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="jora" className="gap-1.5">
              Jora / Indeed
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {data.results.jora.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="gap-1.5">
              LinkedIn
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {data.results.linkedin.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="seek">
            <SourceGrid jobs={data.results.seek} error={data.errors.seek} source="SEEK" />
          </TabsContent>
          <TabsContent value="jora">
            <SourceGrid jobs={data.results.jora} error={data.errors.jora} source="Jora / Indeed" />
          </TabsContent>
          <TabsContent value="linkedin">
            <SourceGrid
              jobs={data.results.linkedin}
              error={data.errors.linkedin}
              source="LinkedIn"
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
