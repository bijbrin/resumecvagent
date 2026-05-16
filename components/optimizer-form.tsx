"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormFields {
  resumeText: string;
  jobUrl: string;
  jobDescriptionText: string;
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
  const poll = useOptimizationPoll();

  function setField(key: keyof FormFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
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
            Paste your current resume as plain text or Markdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            required
            minLength={50}
            placeholder="John Smith&#10;john@example.com | github.com/jsmith&#10;&#10;## Experience&#10;Senior Engineer at Acme Corp (2021–present)…"
            value={fields.resumeText}
            onChange={(e) => setField("resumeText", e.target.value)}
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