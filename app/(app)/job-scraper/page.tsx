"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Search,
  ExternalLink,
  Shield,
  Flag,
  MapPin,
  Building2,
  Clock,
  Sparkles,
  ArrowRight,
  X,
  Wand2,
  FileText,
  CheckCircle2,
} from "lucide-react";
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

interface ExtractedJob extends JobListing {
  description: string;
}

interface ScrapeResult {
  results: {
    seek: JobListing[];
    jora: JobListing[];
    linkedin: JobListing[];
  };
  errors: {
    seek: string | null;
    jora: string | null;
    linkedin: string | null;
  };
  scrapedAt: string;
}

type JobState = "idle" | "working" | "done" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<JobListing["source"], string> = {
  seek: "#14b8a6",
  jora: "#f97316",
  linkedin: "#2563eb",
};

const SOURCE_LABELS: Record<JobListing["source"], string> = {
  seek: "SEEK",
  jora: "Jora / Indeed",
  linkedin: "LinkedIn",
};

const ARRANGEMENT_COLORS: Record<string, string> = {
  Remote: "color-mix(in srgb, #16a34a 12%, transparent)",
  Hybrid: "color-mix(in srgb, #2563eb 10%, transparent)",
  "On-site": "color-mix(in srgb, #6b7280 10%, transparent)",
};
const ARRANGEMENT_TEXT: Record<string, string> = {
  Remote: "#15803d",
  Hybrid: "#1d4ed8",
  "On-site": "#374151",
};

// ── JobCard ───────────────────────────────────────────────────────────────────

function JobCard({
  job,
  jobState,
  extracted,
  onProcess,
  onResult,
}: {
  job: JobListing;
  jobState: JobState;
  extracted: ExtractedJob | null;
  onProcess: () => void;
  onResult: () => void;
}) {
  const accentColor = SOURCE_COLORS[job.source];
  const isWorking = jobState === "working";
  const isDone = jobState === "done" && extracted;

  return (
    <div
      className="relative flex flex-col gap-3 rounded-xl border p-4 overflow-hidden transition-all duration-300"
      style={{
        background: "var(--bg-surface)",
        borderColor: isWorking ? accentColor : "var(--border-default)",
        borderLeft: `3px solid ${accentColor}`,
        boxShadow: isWorking ? `0 0 0 1px ${accentColor}40, 0 0 20px ${accentColor}20` : undefined,
      }}
    >
      {/* Working pulse overlay */}
      {isWorking && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor}08, transparent)`,
            backgroundSize: "200% 100%",
            animation: "shimmerMove 1.5s linear infinite",
          }}
        />
      )}

      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {job.workType && (
            <span
              className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border"
              style={{
                background: "var(--bg-surface-2, #f3f3f5)",
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
              }}
            >
              {job.workType}
            </span>
          )}
          {job.workArrangement && (
            <span
              className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border"
              style={{
                background: ARRANGEMENT_COLORS[job.workArrangement] ?? "var(--bg-surface-2)",
                borderColor: "transparent",
                color: ARRANGEMENT_TEXT[job.workArrangement] ?? "var(--text-secondary)",
              }}
            >
              {job.workArrangement}
            </span>
          )}
        </div>

        <span className="shrink-0 text-[10px] font-mono flex items-center gap-1" style={{ color: "var(--text-faint)" }}>
          <Clock className="size-3" />
          {job.postedAt}
        </span>
      </div>

      {/* ── Title ── */}
      <div>
        <h3 className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>
          {job.title}
        </h3>
        <div className="flex items-center gap-3 mt-1 text-xs flex-wrap" style={{ color: "var(--text-secondary)" }}>
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
        <p className="text-xs font-semibold" style={{ color: "var(--accent-primary)" }}>
          {job.salary}
        </p>
      )}

      {/* ── Bullet points / description ── */}
      {(job.bulletPoints?.length ?? 0) > 0 ? (
        <ul className="flex flex-col gap-1">
          {job.bulletPoints!.map((bp, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              <span className="mt-1 size-1 rounded-full shrink-0 bg-current opacity-50" />
              <span className="line-clamp-2">{bp}</span>
            </li>
          ))}
        </ul>
      ) : job.description ? (
        <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--text-secondary)" }}>
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
                background: "color-mix(in srgb, #dc2626 10%, transparent)",
                borderColor: "color-mix(in srgb, #dc2626 30%, transparent)",
                color: "#b91c1c",
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
                background: "color-mix(in srgb, #2563eb 8%, transparent)",
                borderColor: "color-mix(in srgb, #2563eb 25%, transparent)",
                color: "#1d4ed8",
              }}
            >
              <Flag className="size-2.5" />
              AU citizen / PR
            </span>
          )}
        </div>
      )}

      {/* ── Footer: source badge + action buttons ── */}
      <div className="flex items-center justify-between pt-1 mt-auto border-t gap-2" style={{ borderColor: "var(--border-default)" }}>
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>
          {SOURCE_LABELS[job.source]}
        </span>

        <div className="flex items-center gap-1.5">
          {/* Process / Working / Result button */}
          {isDone ? (
            <Button
              onClick={onResult}
              size="sm"
              className="gap-1 h-7 px-2.5 text-xs"
              style={{ background: "var(--state-success)", color: "#fff" }}
            >
              <CheckCircle2 className="size-3" />
              Result
            </Button>
          ) : isWorking ? (
            <Button
              disabled
              size="sm"
              className="gap-1 h-7 px-2.5 text-xs"
              style={{
                background: accentColor,
                color: "#fff",
                opacity: 0.9,
              }}
            >
              <Loader2 className="size-3 animate-spin" />
              Working…
            </Button>
          ) : (
            <Button
              onClick={onProcess}
              size="sm"
              className="gap-1 h-7 px-2.5 text-xs"
              style={{
                background: accentColor,
                color: "#fff",
              }}
            >
              <Sparkles className="size-3" />
              Process
            </Button>
          )}

          {/* Apply button */}
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-7 px-2.5 text-xs"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-secondary)",
                }}
              >
                <ExternalLink className="size-3" />
                Apply
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── JobModal ────────────────────────────────────────────────────────────────────

function JobModal({
  job,
  onClose,
  onLetsGo,
}: {
  job: ExtractedJob;
  onClose: () => void;
  onLetsGo: () => void;
}) {
  const accentColor = SOURCE_COLORS[job.source];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border flex flex-col animate-scale-in"
        style={{
          background: "var(--bg-base)",
          borderColor: "var(--border-default)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: `${accentColor}15`, color: accentColor }}
              >
                {SOURCE_LABELS[job.source]}
              </span>
              {job.workArrangement && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                  style={{
                    background: ARRANGEMENT_COLORS[job.workArrangement],
                    borderColor: "transparent",
                    color: ARRANGEMENT_TEXT[job.workArrangement],
                  }}
                >
                  {job.workArrangement}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold tracking-tight leading-snug" style={{ color: "var(--text-primary)" }}>
              {job.title}
            </h2>
            <div className="flex items-center gap-3 mt-1.5 text-sm flex-wrap" style={{ color: "var(--text-secondary)" }}>
              {job.company && (
                <span className="flex items-center gap-1">
                  <Building2 className="size-3.5 shrink-0" />
                  {job.company}
                </span>
              )}
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" />
                  {job.location}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:opacity-70 transition-opacity flex-shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 flex flex-col gap-5">
          {/* Meta row */}
          <div className="flex flex-wrap gap-3">
            {job.salary && (
              <div
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "var(--bg-surface)", color: "var(--accent-primary)", border: "1px solid var(--border-default)" }}
              >
                <FileText className="size-3.5" />
                {job.salary}
              </div>
            )}
            {job.workType && (
              <div
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
              >
                <Clock className="size-3.5" />
                {job.workType}
              </div>
            )}
            {(job.requiresClearance || job.requiresCitizenship) && (
              <div
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{
                  background: "color-mix(in srgb, var(--state-warn) 10%, transparent)",
                  color: "var(--state-warn)",
                  border: "1px solid color-mix(in srgb, var(--state-warn) 30%, transparent)",
                }}
              >
                <Shield className="size-3.5" />
                {job.requiresClearance && "Clearance"}
                {job.requiresClearance && job.requiresCitizenship && " · "}
                {job.requiresCitizenship && "AU Citizen / PR"}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-faint)" }}>
              Job Description
            </h3>
            <div
              className="rounded-xl border p-4 text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                maxHeight: "320px",
                overflowY: "auto",
              }}
            >
              {job.description || "No description available."}
            </div>
          </div>

          {/* Bullet points if available */}
          {job.bulletPoints && job.bulletPoints.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-faint)" }}>
                Key Points
              </h3>
              <ul className="flex flex-col gap-2">
                {job.bulletPoints.map((bp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <CheckCircle2 className="size-4 mt-0.5 shrink-0" style={{ color: accentColor }} />
                    <span>{bp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 border-t flex items-center justify-between gap-4" style={{ borderColor: "var(--border-default)" }}>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:underline flex items-center gap-1"
            style={{ color: "var(--text-muted)" }}
          >
            <ExternalLink className="size-3" />
            View original posting
          </a>
          <Button
            onClick={onLetsGo}
            className="gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl"
            style={{ background: accentColor, color: "#fff" }}
          >
            <Wand2 className="size-4" />
            Let&apos;s go
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── SourceGrid ────────────────────────────────────────────────────────────────

function SourceGrid({
  jobs,
  error,
  source,
  jobStates,
  extractedMap,
  onProcess,
  onResult,
}: {
  jobs: JobListing[];
  error: string | null;
  source: string;
  jobStates: Record<string, JobState>;
  extractedMap: Record<string, ExtractedJob>;
  onProcess: (job: JobListing) => void;
  onResult: (job: JobListing) => void;
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
        <JobCard
          key={`${job.url}-${i}`}
          job={job}
          jobState={jobStates[job.url] ?? "idle"}
          extracted={extractedMap[job.url] ?? null}
          onProcess={() => onProcess(job)}
          onResult={() => onResult(job)}
        />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const CACHE_KEY = "job-scraper-cache";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 4; // 4 hours

function loadCachedData(): { data: ScrapeResult; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.data || !parsed.timestamp) return null;
    const age = Date.now() - parsed.timestamp;
    if (age > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedData(data: ScrapeResult) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // ignore storage errors
  }
}

export default function JobScraperPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [data, setData] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-job processing state
  const [jobStates, setJobStates] = useState<Record<string, JobState>>({});
  const [extractedMap, setExtractedMap] = useState<Record<string, ExtractedJob>>({});

  // Modal
  const [modalJob, setModalJob] = useState<ExtractedJob | null>(null);

  // Load cached scan results on mount
  useEffect(() => {
    const cached = loadCachedData();
    if (cached) {
      setData(cached.data);
      setStatus("done");
    }
  }, []);

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
      saveCachedData(json);
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  }

  async function handleProcess(job: JobListing) {
    const url = job.url;
    setJobStates((prev) => ({ ...prev, [url]: "working" }));

    try {
      const res = await fetch("/api/job-scraper/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: job.url,
          source: job.source,
          existing: job, // pass existing data as fallback
        }),
      });

      if (!res.ok) {
        // Even on error, try to use existing data
        setExtractedMap((prev) => ({
          ...prev,
          [url]: { ...job, description: job.description || "No detailed description available." },
        }));
        setJobStates((prev) => ({ ...prev, [url]: "done" }));
        return;
      }

      const json = await res.json();
      if (!json.job) {
        setExtractedMap((prev) => ({
          ...prev,
          [url]: { ...job, description: job.description || "No detailed description available." },
        }));
        setJobStates((prev) => ({ ...prev, [url]: "done" }));
        return;
      }

      const extracted: ExtractedJob = {
        ...job,
        ...json.job,
        description: json.job.description || job.description || "No detailed description available.",
      };

      setExtractedMap((prev) => ({ ...prev, [url]: extracted }));
      setJobStates((prev) => ({ ...prev, [url]: "done" }));
    } catch {
      // On network error, still show the card with existing data
      setExtractedMap((prev) => ({
        ...prev,
        [url]: { ...job, description: job.description || "No detailed description available." },
      }));
      setJobStates((prev) => ({ ...prev, [url]: "done" }));
    }
  }

  function handleResult(job: JobListing) {
    const extracted = extractedMap[job.url];
    if (extracted) {
      setModalJob(extracted);
    }
  }

  function handleLetsGo() {
    if (!modalJob) return;
    const params = new URLSearchParams({
      jobUrl: modalJob.url,
      jobTitle: modalJob.title,
      jobCompany: modalJob.company,
      jobDesc: modalJob.description,
      jobLocation: modalJob.location,
      jobSource: modalJob.source,
    });
    if (modalJob.salary) params.set("jobSalary", modalJob.salary);
    if (modalJob.workType) params.set("jobWorkType", modalJob.workType);
    if (modalJob.workArrangement) params.set("jobArrangement", modalJob.workArrangement);

    setModalJob(null);
    router.push(`/optimizer?${params.toString()}`);
  }

  const total = data
    ? data.results.seek.length + data.results.jora.length + data.results.linkedin.length
    : 0;

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Job Board Scanner
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Scans SEEK, Jora (includes Indeed listings), and LinkedIn for Australian IT &amp; software jobs posted in the last 24 hours.
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
          <div className="flex items-center gap-2 flex-wrap">
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
            {(() => {
              try {
                const raw = localStorage.getItem(CACHE_KEY);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed.data?.scrapedAt === data.scrapedAt) {
                    const ageMin = Math.floor((Date.now() - parsed.timestamp) / 60000);
                    return (
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                        style={{
                          background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
                          borderColor: "color-mix(in srgb, var(--accent-primary) 25%, transparent)",
                          color: "var(--accent-primary)",
                        }}
                      >
                        Cached · {ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ago`}
                      </span>
                    );
                  }
                }
              } catch { /* ignore */ }
              return null;
            })()}
          </div>
        )}
      </div>

      {/* ── Error banner ── */}
      {status === "error" && error && (
        <div
          className="rounded-lg border px-4 py-3 text-sm mb-6"
          style={{
            background: "color-mix(in srgb, var(--state-error) 10%, transparent)",
            borderColor: "var(--state-error)",
            color: "var(--state-error)",
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
            <SourceGrid
              jobs={data.results.seek}
              error={data.errors.seek}
              source="SEEK"
              jobStates={jobStates}
              extractedMap={extractedMap}
              onProcess={handleProcess}
              onResult={handleResult}
            />
          </TabsContent>
          <TabsContent value="jora">
            <SourceGrid
              jobs={data.results.jora}
              error={data.errors.jora}
              source="Jora / Indeed"
              jobStates={jobStates}
              extractedMap={extractedMap}
              onProcess={handleProcess}
              onResult={handleResult}
            />
          </TabsContent>
          <TabsContent value="linkedin">
            <SourceGrid
              jobs={data.results.linkedin}
              error={data.errors.linkedin}
              source="LinkedIn"
              jobStates={jobStates}
              extractedMap={extractedMap}
              onProcess={handleProcess}
              onResult={handleResult}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* ── Modal ── */}
      {modalJob && (
        <JobModal job={modalJob} onClose={() => setModalJob(null)} onLetsGo={handleLetsGo} />
      )}
    </div>
  );
}
