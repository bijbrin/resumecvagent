"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent, type ChangeEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FileText, Loader2, X, UploadCloud } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { type AgentStatusMap, type CompanyResearch, type JobDetails } from "@/lib/state/resumeState";
import { AgentPipeline } from "@/components/agent-pipeline";

// ── Saved-resume types ────────────────────────────────────────────────────────

type ResumeSourceLabel = "TEXT" | "PDF" | "DOCX";

interface ResumeMeta {
  id:        string;
  name:      string;
  source:    ResumeSourceLabel;
  createdAt: string;
}

interface ResumeRecord extends ResumeMeta {
  content: string;
}

// ── Types ─────────────────────────────────────────────────────────────────────

/** Minimal result shape captured from the optimize result endpoint. Only
 *  `fitScore` is consumed by the AgentPipeline; the full resume / cover-letter
 *  / report / interview bodies live in the promoted JobApplication's folder and
 *  are read from disk on the application detail page. */
interface RunResult {
  fitScore: number | null;
}

interface FormFields {
  resumeText: string;
  jobUrl: string;
  jobDescriptionText: string;
  resumeId?: string;
}

interface ApiResponse {
  correlationId?: string;
  status?: string;
  error?: string;
}

interface StatusResponse {
  correlationId: string;
  status: string;
  agentStatus: AgentStatusMap | null;
  warnings: string[];
  createdAt: string;
  completedAt: string | null;
}

interface ResultResponse {
  correlationId: string;
  status: "DONE" | "RUNNING" | "FAILED";
  result?: {
    optimizedResumeContent: string | null;
    optimizedCoverLetter:   string | null;
    interviewCheatsheet:    string | null;
    reportMarkdown:         string | null;
    fitScore:               number | null;
    warnings:               string[];
    companyResearch:        CompanyResearch | null;
    jobDetails:             JobDetails | null;
  };
  /** JobApplication id promoted from this run (present once the run is DONE
   *  and the promote step has linked it to a tracked application). */
  applicationId?: string | null;
  error?: string;
}

// The 8 agents in execution order — shown in the entry-screen pipeline preview.
const PIPELINE_PREVIEW: Array<{ code: string; label: string; stageTag: string }> = [
  { code: "IP", label: "Input Parser",        stageTag: "Stage 1" },
  { code: "JB", label: "Job Agent",           stageTag: "Stage 2" },
  { code: "CR", label: "Company Research",    stageTag: "Stage 2" },
  { code: "RA", label: "Resume Analyzer",     stageTag: "Stage 2" },
  { code: "ST", label: "Strategy Agent",      stageTag: "Stage 3" },
  { code: "RW", label: "Resume Writer",       stageTag: "Stage 4" },
  { code: "CW", label: "Cover Letter Writer", stageTag: "Stage 4" },
  { code: "FC", label: "Final Compiler",      stageTag: "Stage 5" },
];

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 5 * 60 * 1000; // give up after 5 minutes of polling

// ── Hook: poll optimization status ────────────────────────────────────────────

type PollPhase = "idle" | "submitting" | "polling" | "done" | "error";

function useOptimizationPoll() {
  const [phase, setPhase] = useState<PollPhase>("idle");
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [results, setResults] = useState<RunResult | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setPhase("idle");
    setCorrelationId(null);
    setStatus(null);
    setResults(null);
    setApplicationId(null);
    setErrorMessage(null);
  }, [stopPolling]);

  const start = useCallback(async (fields: FormFields) => {
    stopPolling();
    setPhase("submitting");
    setCorrelationId(null);
    setStatus(null);
    setResults(null);
    setApplicationId(null);
    setErrorMessage(null);
    setStartedAt(Date.now());

    try {
      // 1. Submit the optimization request
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });

      if (!res.ok) {
        let detail = `Server error ${res.status}`;
        try {
          const errJson = (await res.json()) as ApiResponse;
          detail = errJson.error ?? detail;
        } catch { /* response wasn't JSON */ }
        setErrorMessage(detail);
        setPhase("error");
        return;
      }

      const json = (await res.json()) as ApiResponse;
      if (!json.correlationId) {
        setErrorMessage("Missing correlation ID from server");
        setPhase("error");
        return;
      }

      const cid = json.correlationId;
      setCorrelationId(cid);
      setPhase("polling");

      // 2. Start polling status
      const pollStartedAt = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - pollStartedAt > MAX_POLL_MS) {
          stopPolling();
          setErrorMessage("Optimization timed out. Please try again.");
          setPhase("error");
          return;
        }

        try {
          const statusRes = await fetch(`/api/optimize/status/${cid}`);
          if (!statusRes.ok) {
            if (statusRes.status === 404) {
              setErrorMessage("Optimization run not found");
              stopPolling();
              setPhase("error");
            }
            return;
          }

          const statusJson = (await statusRes.json()) as StatusResponse;
          setStatus(statusJson);

          if (statusJson.status === "DONE") {
            stopPolling();
            // 3. Fetch results
            const resultRes = await fetch(`/api/optimize/result/${cid}`);
            if (!resultRes.ok) {
              setErrorMessage("Failed to fetch results");
              setPhase("error");
              return;
            }
            const resultJson = (await resultRes.json()) as ResultResponse;
            if (resultJson.status === "DONE" && resultJson.result) {
              const promotedId = resultJson.applicationId ?? null;
              setResults({ fitScore: resultJson.result.fitScore });
              setApplicationId(promotedId);
              setPhase("done");
            }
          } else if (statusJson.status === "FAILED") {
            stopPolling();
            const lastWarning = statusJson.warnings[statusJson.warnings.length - 1] ?? "Optimization failed";
            setErrorMessage(lastWarning);
            setPhase("error");
          }
        } catch {
          // Polling error — keep trying
        }
      }, POLL_INTERVAL_MS);
    } catch {
      setErrorMessage("Network error — please check your connection and try again.");
      setPhase("error");
    }
  }, [stopPolling]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const isLoading = phase === "submitting" || phase === "polling";

  return { phase, isLoading, correlationId, status, results, applicationId, errorMessage, startedAt, start, reset };
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function OptimizerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Pre-fill from URL query params (coming from the job scanner) at init — no
  // effect needed, so there's no setState-in-effect cascade.
  const [fields, setFields] = useState<FormFields>(() => ({
    resumeText: "",
    jobUrl: searchParams.get("jobUrl") ?? "",
    jobDescriptionText: searchParams.get("jobDesc") ?? "",
  }));
  const [resumes, setResumes] = useState<ResumeMeta[]>([]);
  const [activeResume, setActiveResume] = useState<ResumeMeta | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const prefilledFromUrl = Boolean(searchParams.get("jobUrl"));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const poll = useOptimizationPoll();

  // Load saved resumes on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/resumes")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { resumes: ResumeMeta[] } | null) => {
        if (!cancelled && j?.resumes) {
          setResumes(j.resumes);
          // Auto-select the most recent resume if none selected yet
          if (j.resumes.length > 0 && !activeResume && fields.resumeText === "") {
            const mostRecent = j.resumes[0];
            fetch(`/api/resumes/${mostRecent.id}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((data: { resume: ResumeRecord } | null) => {
                if (!cancelled && data?.resume) {
                  setFields((prev) => ({
                    ...prev,
                    resumeText: data.resume.content,
                    resumeId: data.resume.id,
                  }));
                  setActiveResume({
                    id: data.resume.id,
                    name: data.resume.name,
                    source: data.resume.source,
                    createdAt: data.resume.createdAt,
                  });
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => { /* ignore — picker just stays empty */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(key: keyof FormFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function setResumeText(value: string) {
    // Editing the textarea breaks the link to the selected saved resume —
    // that way the edited content gets auto-saved as a new history entry.
    setFields((prev) => ({ ...prev, resumeText: value, resumeId: undefined }));
    setActiveResume(null);
  }

  async function pickResume(id: string) {
    if (!id) return;
    setUploadError(null);
    try {
      const res = await fetch(`/api/resumes/${id}`);
      if (!res.ok) throw new Error("Could not load that resume");
      const j = (await res.json()) as { resume: ResumeRecord };
      setFields((prev) => ({ ...prev, resumeText: j.resume.content, resumeId: j.resume.id }));
      setActiveResume({
        id:        j.resume.id,
        name:      j.resume.name,
        source:    j.resume.source,
        createdAt: j.resume.createdAt,
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to load resume");
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same filename
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resumes/upload", { method: "POST", body: fd });
      const j = (await res.json()) as { resume?: ResumeRecord; error?: string };
      if (!res.ok || !j.resume) throw new Error(j.error ?? "Upload failed");

      setFields((prev) => ({ ...prev, resumeText: j.resume!.content, resumeId: j.resume!.id }));
      setActiveResume({
        id:        j.resume.id,
        name:      j.resume.name,
        source:    j.resume.source,
        createdAt: j.resume.createdAt,
      });
      setResumes((prev) => [
        { id: j.resume!.id, name: j.resume!.name, source: j.resume!.source, createdAt: j.resume!.createdAt },
        ...prev,
      ]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function clearActiveResume() {
    setActiveResume(null);
    setFields((prev) => ({ ...prev, resumeId: undefined }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await poll.start(fields);
  }

  const agentStatus: AgentStatusMap | null = poll.status?.agentStatus ?? null;
  const runActive = poll.phase === "submitting" || poll.phase === "polling" || poll.phase === "done";
  // Promotion should have linked the run to a JobApplication by the time the
  // graph reports DONE. If it didn't, surface a clear error instead of a dead
  // "View results" button.
  const promoteFailed =
    poll.phase === "done" && !poll.applicationId;

  // When the run finishes, the optimizer's "results" ARE the promoted
  // JobApplication — navigate to the application detail page, which renders the
  // same rich view (DocumentPanel with edit / regenerate .docx + .pdf / download,
  // AI Chat, insights) used by tracked applications.
  function viewResults() {
    if (poll.applicationId) {
      router.push(`/applications/${poll.applicationId}`);
    }
  }

  // Live multi-agent pipeline — bound to the real streamed agent status.
  if (runActive && !promoteFailed) {
    return (
      <AgentPipeline
        agentStatus={agentStatus}
        startedAt={poll.startedAt}
        complete={poll.phase === "done"}
        fitScore={poll.results?.fitScore ?? null}
        warnings={poll.status?.warnings ?? []}
        onReplay={() => poll.start(fields)}
        onViewResults={poll.phase === "done" ? viewResults : undefined}
      />
    );
  }

  if (promoteFailed) {
    return (
      <div className="mx-auto w-full max-w-[640px] py-16 px-4">
        <div
          className="rounded-[14px] px-5 py-4 text-sm"
          style={{
            background: "color-mix(in srgb, var(--state-error) 10%, transparent)",
            border: "1px solid var(--state-error)",
            color: "var(--state-error)",
          }}
        >
          The agents finished, but we couldn&apos;t save the results to your
          applications. Please try again.
        </div>
        <button
          type="button"
          onClick={() => poll.reset()}
          className="mt-4 rounded-[11px] px-4 py-2 text-sm font-medium"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          Start over
        </button>
      </div>
    );
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: "10.5px",
    letterSpacing: "0.1em",
    color: "var(--text-secondary)",
  };

  // ── Entry screen (idle / error) ─────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[1080px]">
      {/* Header block */}
      <div className="mb-7">
        <span className="font-mono text-[11px]" style={{ letterSpacing: "0.16em", color: "var(--accent)" }}>
          NEW&nbsp;OPTIMIZATION
        </span>
        <h1 className="mt-3 mb-2 text-[30px] font-semibold tracking-[-0.022em]" style={{ color: "var(--text-primary)" }}>
          Tailor your application in one pass
        </h1>
        <p className="m-0 max-w-[560px] text-[15px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
          Paste the job posting and drop your resume. Eight agents research the company, analyze fit,
          and write ATS-ready materials — start to finish in about thirty seconds.
        </p>
      </div>

      {/* Pre-filled banner */}
      {prefilledFromUrl && (
        <div
          className="mb-5 flex items-center gap-3 rounded-[14px] px-4 py-3"
          style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-line)" }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Job details loaded from scanner</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {searchParams.get("jobTitle")} · {searchParams.get("jobCompany")}
            </p>
          </div>
          {fields.resumeText.length < 50 && (
            <span className="shrink-0 text-xs font-medium" style={{ color: "var(--state-warn)" }}>Add resume first →</span>
          )}
        </div>
      )}

      {/* Error message */}
      {poll.phase === "error" && poll.errorMessage && (
        <div
          className="mb-5 rounded-[14px] px-4 py-3 text-sm"
          style={{ background: "color-mix(in srgb, var(--state-error) 10%, transparent)", border: "1px solid var(--state-error)", color: "var(--state-error)" }}
        >
          {poll.errorMessage}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* Left — form card */}
        <div
          className="flex flex-col gap-[22px] rounded-[18px] p-6"
          style={{ background: "color-mix(in srgb, var(--surface) 60%, transparent)", border: "1px solid var(--border-default)" }}
        >
          {/* Job posting URL */}
          <div className="flex flex-col gap-[9px]">
            <label htmlFor="job-url" style={labelStyle}>JOB&nbsp;POSTING&nbsp;URL</label>
            <div
              className="flex items-center gap-[11px] rounded-[11px] px-3.5 py-[11px] focus-within:border-[var(--accent-line)]"
              style={{ border: "1px solid var(--border-strong)", background: "var(--bg-elev)" }}
            >
              <span className="flex-none font-mono text-[10px] rounded-[6px] px-[7px] py-[3px]" style={{ color: "var(--accent)", background: "var(--accent-soft)" }}>URL</span>
              <input
                id="job-url"
                required
                type="url"
                placeholder="https://stripe.com/jobs/listing/senior-product-designer"
                value={fields.jobUrl}
                onChange={(e) => setField("jobUrl", e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-mono text-[14px] outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
          </div>

          {/* Resume */}
          <div className="flex flex-col gap-[9px]">
            <label style={labelStyle}>YOUR&nbsp;RESUME</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-[11px] rounded-[13px] p-[22px] text-center transition-colors hover:border-[var(--accent-line)]"
              style={{ border: "1.5px dashed rgba(255,255,255,.16)", background: "rgba(255,255,255,.015)" }}
            >
              {uploading ? (
                <Loader2 className="h-[22px] w-[22px] animate-spin" style={{ color: "var(--accent)" }} />
              ) : (
                <UploadCloud className="h-[22px] w-[22px]" style={{ color: "var(--accent)" }} strokeWidth={1.6} />
              )}
              <div className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
                {uploading ? "Extracting…" : <>Drop a file or <span style={{ color: "var(--accent)" }}>browse</span></>}
              </div>
              <div className="font-mono text-[10.5px]" style={{ color: "var(--text-muted)" }}>PDF · DOCX · MARKDOWN · up to 5MB</div>
            </button>

            {/* Attached file / active source chip */}
            {activeResume && (
              <div
                className="flex items-center gap-[11px] rounded-[10px] px-3 py-2.5"
                style={{ border: "1px solid var(--border-default)", background: "var(--bg-elev)" }}
              >
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px] font-mono text-[9px]" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  {activeResume.source}
                </span>
                <div className="flex min-w-0 flex-col leading-[1.3]">
                  <span className="truncate text-[13px]" style={{ color: "var(--text-primary)" }}>{activeResume.name}</span>
                  <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>ready</span>
                </div>
                <FileText className="ml-auto hidden h-3.5 w-3.5 sm:block" style={{ color: "var(--text-muted)" }} />
                <button type="button" onClick={clearActiveResume} aria-label="Clear source" style={{ color: "var(--text-muted)" }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Saved-resume picker */}
            {resumes.length > 0 && (
              <select
                value={activeResume?.id ?? ""}
                onChange={(e) => pickResume(e.target.value)}
                className="h-9 rounded-[10px] px-2 text-[13px]"
                style={{ background: "var(--bg-elev)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
              >
                <option value="">Use a saved resume…</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.source.toLowerCase()} · {new Date(r.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            )}

            {uploadError && (
              <div className="rounded-[10px] px-3 py-2 text-xs" style={{ background: "color-mix(in srgb, var(--state-error) 10%, transparent)", border: "1px solid var(--state-error)", color: "var(--state-error)" }}>
                {uploadError}
              </div>
            )}

            {/* Paste fallback — keeps text/Markdown entry available */}
            <Textarea
              required
              minLength={50}
              placeholder="…or paste your resume as plain text / Markdown"
              value={fields.resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="h-72 max-h-72 resize-none overflow-y-auto font-mono text-sm"
            />
          </div>

          {/* Optional — job description */}
          <div className="flex flex-col gap-2">
            <label htmlFor="job-desc" style={{ ...labelStyle, fontSize: "10px", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
              JOB&nbsp;DESCRIPTION&nbsp;· OPT
            </label>
            <Textarea
              id="job-desc"
              placeholder="Paste the full description if the URL is behind a login…"
              value={fields.jobDescriptionText}
              onChange={(e) => setField("jobDescriptionText", e.target.value)}
              className="h-48 max-h-48 resize-none overflow-y-auto text-sm"
            />
          </div>

          {/* Optimize */}
          <button
            type="submit"
            disabled={poll.isLoading}
            className="mt-0.5 flex w-full items-center justify-center gap-[11px] rounded-[12px] py-[15px] text-[15px] font-semibold transition-transform duration-150 hover:-translate-y-px disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--shadow-btn)" }}
          >
            Optimize application
            <span className="font-mono text-[11px] opacity-70">· 8 AGENTS · ~30S</span>
          </button>
        </div>

        {/* Right — pipeline preview */}
        <div
          className="flex flex-col gap-4 rounded-[18px] p-[22px]"
          style={{ background: "color-mix(in srgb, var(--surface) 60%, transparent)", border: "1px solid var(--border-default)" }}
        >
          <span className="font-mono text-[10.5px]" style={{ letterSpacing: "0.14em", color: "var(--text-muted)" }}>PIPELINE</span>
          <div className="flex flex-col gap-[11px]">
            {PIPELINE_PREVIEW.map((a) => (
              <div key={a.code} className="flex items-center gap-[11px]">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px] font-mono text-[11px] font-semibold" style={{ background: "rgba(255,255,255,.04)", color: "var(--text-secondary)" }}>
                  {a.code}
                </span>
                <span className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>{a.label}</span>
                <span className="ml-auto font-mono text-[9.5px]" style={{ letterSpacing: "0.06em", color: "var(--text-faint)" }}>{a.stageTag}</span>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-[11px] pt-[15px]" style={{ borderTop: "1px solid var(--border-default)" }}>
            <span className="text-[14px] leading-[1.3]" style={{ color: "var(--accent)" }}>◆</span>
            <p className="m-0 text-[12.5px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
              Every output is scored against the live job description for ATS keyword coverage and role fit before you download.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}