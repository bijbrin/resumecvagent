"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ExternalLink,
  Loader2,
  Sparkles,
  Building2,
  MapPin,
  Globe,
  ClipboardPaste,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { JobTagChips } from "@/components/job-tag-chips";
import type {
  JobListing,
  JobTags,
  WorkArrangement,
  LocationType,
} from "@/lib/scraper/jobTags";

interface JobDetail {
  url: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  companyUrl?: string;
  markdown: string;
  tags: JobTags;
}

const MIN_JD = 30;

export function JobDrawer({
  job,
  onClose,
}: {
  job: JobListing;
  onClose: () => void;
}) {
  const router = useRouter();
  // LinkedIn can't be auto-scraped — the user pastes the JD and edits tags.
  const manual = !!job.needsManualJd;

  // Mounted with a per-job `key`, so state starts fresh for each job.
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(!manual);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  // Manual-mode inputs.
  const [manualJd, setManualJd] = useState("");
  const [editTags, setEditTags] = useState<JobTags>(job.tags);

  // Auto mode: fetch the full description once on mount.
  useEffect(() => {
    if (manual) return;
    let cancelled = false;
    fetch(`/api/job-scraper/detail?url=${encodeURIComponent(job.url)}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(j?.error ?? `Server error ${r.status}`);
        }
        return r.json() as Promise<JobDetail>;
      })
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setDetailError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job.url, manual]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tags = manual ? editTags : detail?.tags ?? job.tags;
  const company = detail?.company || job.company;
  const location = detail?.location || job.location;
  const salary = detail?.salary || job.salary;

  function setTag<K extends keyof JobTags>(key: K, value: JobTags[K]) {
    setEditTags((prev) => ({ ...prev, [key]: value }));
  }

  /** Compose the JD sent to the optimizer, prefixing the user-selected tags. */
  function composeManualJd(): string {
    const lines = [
      editTags.government && "- Government / public-sector role",
      editTags.clearance && "- Security clearance required",
      editTags.citizenship && "- Australian citizenship / PR required",
      editTags.arrangement && `- Work arrangement: ${editTags.arrangement}`,
      editTags.workType && `- Work type: ${editTags.workType}`,
      editTags.locationType && `- Location type: ${editTags.locationType}`,
    ].filter(Boolean);
    const header = lines.length ? `**Key requirements:**\n${lines.join("\n")}\n\n` : "";
    return `${header}${manualJd.trim()}`;
  }

  const optimizeDisabled = optimizing || (manual && manualJd.trim().length < MIN_JD);

  async function handleOptimize() {
    setOptimizing(true);
    setOptimizeError(null);
    try {
      const jobDescription = manual
        ? composeManualJd()
        : detail?.markdown || job.summary || job.title;
      const res = await fetch("/api/job-scraper/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: job.url,
          title: job.title,
          company: job.company,
          location: job.location,
          salary: job.salary ?? "",
          jobDescription,
        }),
      });
      const j = (await res.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null;
      // Even on a soft error the API may return an id (folder created) — route there.
      if (j?.id) {
        router.push(`/applications/${j.id}`);
        return;
      }
      throw new Error(j?.error ?? `Server error ${res.status}`);
    } catch (e) {
      setOptimizeError(e instanceof Error ? e.message : "Failed to start optimization");
      setOptimizing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className="relative flex h-full w-full max-w-xl flex-col shadow-2xl"
        style={{ background: "var(--bg-surface)", borderLeft: "1px solid var(--border-default)" }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
              {job.title}
            </h2>
            <div
              className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              {company && (
                <span className="flex items-center gap-1">
                  <Building2 className="size-3.5 shrink-0" />
                  {company}
                </span>
              )}
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" />
                  {location}
                </span>
              )}
            </div>
            {salary && (
              <p className="mt-1 text-sm font-semibold" style={{ color: "var(--accent-primary)" }}>
                {salary}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tags */}
        <div className="border-b px-5 py-3" style={{ borderColor: "var(--border-default)" }}>
          <JobTagChips tags={tags} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {manual ? (
            <ManualJdEditor
              jobUrl={job.url}
              manualJd={manualJd}
              setManualJd={setManualJd}
              tags={editTags}
              setTag={setTag}
            />
          ) : (
            <>
              {loading && (
                <div
                  className="flex items-center gap-2 py-10 text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Loader2 className="size-4 animate-spin" />
                  Loading full description…
                </div>
              )}
              {detailError && !loading && (
                <p className="py-6 text-sm" style={{ color: "var(--state-error)" }}>
                  {detailError} You can still open the listing or optimize from the snippet.
                </p>
              )}
              {!loading && (detail?.markdown || job.summary) && (
                <pre
                  className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {detail?.markdown || job.summary}
                </pre>
              )}
            </>
          )}
        </div>

        {/* Footer — actions */}
        <div className="flex flex-col gap-2 border-t px-5 py-4" style={{ borderColor: "var(--border-default)" }}>
          {optimizeError && (
            <p className="text-xs" style={{ color: "var(--state-error)" }}>
              {optimizeError}
            </p>
          )}
          {manual && manualJd.trim().length < MIN_JD && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Paste the job description above to enable optimization.
            </p>
          )}
          <div className="flex items-center gap-2">
            {detail?.companyUrl && (
              <a href={detail.companyUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Globe className="size-3.5" />
                  Company site
                </Button>
              </a>
            )}
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="size-3.5" />
                Open listing
              </Button>
            </a>
            <Button
              onClick={handleOptimize}
              disabled={optimizeDisabled}
              className="ml-auto gap-1.5 shadow-[0_8px_24px_-6px_rgba(104,67,236,0.55)]"
              style={{ background: "var(--accent-gradient)", color: "var(--text-on-accent)" }}
            >
              {optimizing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Optimize with AI
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Manual JD editor (LinkedIn) ───────────────────────────────────────────────

const ARRANGEMENTS: WorkArrangement[] = ["Remote", "Hybrid", "On-site"];
const WORK_TYPES = ["Full time", "Part time", "Contract", "Casual", "Internship"];
const LOCATION_TYPES: LocationType[] = ["City", "Regional"];

function ManualJdEditor({
  jobUrl,
  manualJd,
  setManualJd,
  tags,
  setTag,
}: {
  jobUrl: string;
  manualJd: string;
  setManualJd: (v: string) => void;
  tags: JobTags;
  setTag: <K extends keyof JobTags>(key: K, value: JobTags[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed"
        style={{
          background: "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
          borderColor: "var(--border-default)",
          color: "var(--text-secondary)",
        }}
      >
        <ClipboardPaste className="mt-0.5 size-4 shrink-0" style={{ color: "var(--accent-primary)" }} />
        <span>
          LinkedIn blocks automated scraping.{" "}
          <a
            href={jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
            style={{ color: "var(--accent-text)" }}
          >
            Open the listing
          </a>
          , copy the job description, and paste it below. Confirm the tags, then optimize.
        </span>
      </div>

      <Textarea
        placeholder="Paste the full LinkedIn job description here…"
        value={manualJd}
        onChange={(e) => setManualJd(e.target.value)}
        className="min-h-48 text-sm resize-y"
      />

      {/* Tag editor */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Tags
        </p>

        <div className="flex flex-wrap gap-3">
          <TagCheckbox label="Government" checked={tags.government} onChange={(v) => setTag("government", v)} />
          <TagCheckbox label="Clearance required" checked={tags.clearance} onChange={(v) => setTag("clearance", v)} />
          <TagCheckbox label="AU citizen / PR" checked={tags.citizenship} onChange={(v) => setTag("citizenship", v)} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <TagSelect
            label="Arrangement"
            value={tags.arrangement ?? ""}
            options={ARRANGEMENTS}
            onChange={(v) => setTag("arrangement", (v || undefined) as WorkArrangement | undefined)}
          />
          <TagSelect
            label="Work type"
            value={tags.workType ?? ""}
            options={WORK_TYPES}
            onChange={(v) => setTag("workType", v || undefined)}
          />
          <TagSelect
            label="Location"
            value={tags.locationType ?? ""}
            options={LOCATION_TYPES}
            onChange={(v) => setTag("locationType", (v || undefined) as LocationType | undefined)}
          />
        </div>
      </div>
    </div>
  );
}

function TagCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded accent-[var(--accent-primary)]"
      />
      {label}
    </label>
  );
}

function TagSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border px-2 text-sm"
        style={{
          background: "var(--bg-base)",
          color: "var(--text-primary)",
          borderColor: "var(--border-default)",
        }}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
