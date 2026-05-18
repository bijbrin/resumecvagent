"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent, type ChangeEvent } from "react";
import { Upload, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentStatus, type AgentName, type AgentStatusMap, type CompanyResearch, type JobDetails } from "@/lib/state/resumeState";
import { ResultsView, type ResultsData } from "@/components/results-view";
import { saveSearch } from "@/lib/search-history";

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
  error?: string;
}

// The 8 agents in execution order — shown in the loading panel.
const AGENT_SEQUENCE: Array<{ name: AgentName; label: string }> = [
  { name: "inputParser",       label: "Parse inputs"       },
  { name: "jobAgent",          label: "Scrape job posting" },
  { name: "companyAgent",      label: "Research company"   },
  { name: "resumeAnalyzer",    label: "Analyse resume"     },
  { name: "strategyAgent",     label: "Build strategy"     },
  { name: "resumeWriter",      label: "Rewrite resume"     },
  { name: "coverLetterWriter", label: "Write cover letter" },
  { name: "finalCompiler",     label: "Compile report"     },
];

const POLL_INTERVAL_MS = 2000;

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const map: Record<AgentStatus, { label: string; style: React.CSSProperties }> = {
    [AgentStatus.Pending]:   { label: "pending",   style: { background: "var(--bg-base)", color: "var(--text-muted)", borderColor: "var(--border-default)" } },
    [AgentStatus.Running]:   { label: "running…",  style: { background: "var(--accent-primary)", color: "#fff", borderColor: "var(--accent-primary)" } },
    [AgentStatus.Completed]: { label: "done",      style: { background: "var(--state-success)", color: "#fff", borderColor: "var(--state-success)" } },
    [AgentStatus.Failed]:    { label: "failed",    style: { background: "var(--state-error)",   color: "#fff", borderColor: "var(--state-error)"   } },
  };
  const { label, style } = map[status];
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-mono px-1.5 py-0"
      style={style}
    >
      {label}
    </Badge>
  );
}

function LoadingPanel({ agentStatus }: { agentStatus: AgentStatusMap | null }) {
  return (
    <Card style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base" style={{ color: "var(--text-primary)" }}>
          Optimizing…
        </CardTitle>
        <CardDescription style={{ color: "var(--text-muted)" }}>
          The agent graph is running. This may take 30–60 seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-2">
          {AGENT_SEQUENCE.map(({ name, label }) => {
            const status = agentStatus?.[name]?.status ?? AgentStatus.Pending;
            return (
              <li key={name} className="flex items-center justify-between gap-4">
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {label}
                </span>
                <AgentStatusBadge status={status} />
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

// ── Hook: poll optimization status ────────────────────────────────────────────

type PollPhase = "idle" | "submitting" | "polling" | "done" | "error";

function useOptimizationPoll() {
  const [phase, setPhase] = useState<PollPhase>("idle");
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    setErrorMessage(null);
  }, [stopPolling]);

  const start = useCallback(async (fields: FormFields) => {
    stopPolling();
    setPhase("submitting");
    setCorrelationId(null);
    setStatus(null);
    setResults(null);
    setErrorMessage(null);

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
      pollRef.current = setInterval(async () => {
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
              const resultsData: ResultsData = {
                correlationId:          cid,
                optimizedResumeContent: resultJson.result.optimizedResumeContent,
                optimizedCoverLetter:   resultJson.result.optimizedCoverLetter,
                interviewCheatsheet:    resultJson.result.interviewCheatsheet,
                reportMarkdown:         resultJson.result.reportMarkdown,
                fitScore:               resultJson.result.fitScore,
                warnings:               resultJson.result.warnings,
                companyResearch:        resultJson.result.companyResearch ?? null,
                jobDetails:             resultJson.result.jobDetails ?? null,
              };
              setResults(resultsData);
              setPhase("done");
              saveSearch(fields.jobUrl, resultsData);
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

  return { phase, isLoading, correlationId, status, results, errorMessage, start, reset };
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function OptimizerForm() {
  const [fields, setFields] = useState<FormFields>({
    resumeText: "",
    jobUrl: "",
    jobDescriptionText: "",
  });
  const [resumes, setResumes] = useState<ResumeMeta[]>([]);
  const [activeResume, setActiveResume] = useState<ResumeMeta | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const poll = useOptimizationPoll();

  // Load saved resumes on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/resumes")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { resumes: ResumeMeta[] } | null) => {
        if (!cancelled && j?.resumes) setResumes(j.resumes);
      })
      .catch(() => { /* ignore — picker just stays empty */ });
    return () => { cancelled = true; };
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

  if (poll.phase === "done" && poll.results) {
    return (
      <ResultsView
        data={poll.results}
        onReset={() => {
          poll.reset();
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full max-w-2xl">
      {/* Resume section */}
      <Card style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
        <CardHeader>
          <CardTitle style={{ color: "var(--text-primary)" }}>Your Resume</CardTitle>
          <CardDescription style={{ color: "var(--text-muted)" }}>
            Upload a PDF or DOCX, pick a saved resume, or paste plain text/Markdown below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Upload + saved-resume picker */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Extracting…" : "Upload PDF / DOCX"}
            </Button>

            {resumes.length > 0 && (
              <select
                value={activeResume?.id ?? ""}
                onChange={(e) => pickResume(e.target.value)}
                className="h-9 rounded-md border px-2 text-sm"
                style={{
                  background:  "var(--bg-base)",
                  color:       "var(--text-primary)",
                  borderColor: "var(--border-default)",
                }}
              >
                <option value="">Use a saved resume…</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.source.toLowerCase()} · {new Date(r.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            )}

            <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
              Max 5 MB
            </span>
          </div>

          {/* Active source badge */}
          {activeResume && (
            <div
              className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
              style={{
                background:  "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
                borderColor: "var(--border-default)",
                color:       "var(--text-secondary)",
              }}
            >
              <FileText className="h-3.5 w-3.5" style={{ color: "var(--accent-primary)" }} />
              <span>
                From{" "}
                <span style={{ color: "var(--text-primary)" }} className="font-medium">
                  {activeResume.name}
                </span>{" "}
                · {activeResume.source.toLowerCase()}
              </span>
              <button
                type="button"
                onClick={clearActiveResume}
                className="ml-auto inline-flex items-center"
                style={{ color: "var(--text-muted)" }}
                aria-label="Clear source"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Upload error */}
          {uploadError && (
            <div
              className="rounded-md border px-3 py-2 text-xs"
              style={{
                background:  "color-mix(in srgb, var(--state-error) 10%, transparent)",
                borderColor: "var(--state-error)",
                color:       "var(--state-error)",
              }}
            >
              {uploadError}
            </div>
          )}

          <Textarea
            required
            minLength={50}
            placeholder="John Smith&#10;john@example.com | github.com/jsmith&#10;&#10;## Experience&#10;Senior Engineer at Acme Corp (2021–present)…"
            value={fields.resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            className="min-h-52 font-mono text-sm resize-y"
          />
        </CardContent>
      </Card>

      {/* Job Details section */}
      <Card style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
        <CardHeader>
          <CardTitle style={{ color: "var(--text-primary)" }}>Job Details</CardTitle>
          <CardDescription style={{ color: "var(--text-muted)" }}>
            Link to the job posting. Paste the description if the listing is behind a login.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="job-url"
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Job URL{" "}
              <span style={{ color: "var(--accent-primary)" }}>*</span>
            </label>
            <Input
              id="job-url"
              required
              type="url"
              placeholder="https://linkedin.com/jobs/view/1234567890"
              value={fields.jobUrl}
              onChange={(e) => setField("jobUrl", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="job-desc"
              className="text-sm font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Job Description{" "}
              <span className="font-normal text-xs">(optional)</span>
            </label>
            <Textarea
              id="job-desc"
              placeholder="Paste the full job description here if the URL is behind a login…"
              value={fields.jobDescriptionText}
              onChange={(e) => setField("jobDescriptionText", e.target.value)}
              className="min-h-32 text-sm resize-y"
            />
          </div>
        </CardContent>
      </Card>

      {/* Loading panel — visible while the graph runs */}
      {poll.isLoading && (
        <LoadingPanel agentStatus={poll.status?.agentStatus ?? null} />
      )}

      {/* Error message */}
      {poll.phase === "error" && poll.errorMessage && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            background: "color-mix(in srgb, var(--state-error) 10%, transparent)",
            borderColor: "var(--state-error)",
            color: "var(--state-error)",
          }}
        >
          {poll.errorMessage}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={poll.isLoading}
          style={{ background: "var(--accent-primary)", color: "#fff" }}
        >
          {poll.isLoading ? "Optimizing…" : "Optimize Resume"}
        </Button>
      </div>
    </form>
  );
}