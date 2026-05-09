"use client";

import { useState } from "react";
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
import { AgentStatus, type AgentName } from "@/lib/state/resumeState";
import { ResultsView, type ResultsData } from "@/components/results-view";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormFields {
  resumeText: string;
  jobUrl: string;
  jobDescriptionText: string;
}

type FormStatus = "idle" | "loading" | "success" | "error";

interface ApiResponse {
  correlationId?: string;
  result?: {
    optimizedResumeContent: string | null;
    optimizedCoverLetter:   string | null;
    interviewCheatsheet:    string | null;
    reportMarkdown:         string | null;
    fitScore:               number | null;
    warnings:               string[];
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

function LoadingPanel() {
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
          {AGENT_SEQUENCE.map(({ name, label }) => (
            <li key={name} className="flex items-center justify-between gap-4">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {label}
              </span>
              {/* Skeleton stubs running synchronously — statuses will be
                  live via SSE once streaming is wired in a later step. */}
              <AgentStatusBadge status={AgentStatus.Pending} />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function OptimizerForm() {
  const [fields, setFields] = useState<FormFields>({
    resumeText: "",
    jobUrl: "",
    jobDescriptionText: "",
  });
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [results, setResults] = useState<ResultsData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function setField(key: keyof FormFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });

      if (!res.ok) {
        // Attempt to parse a JSON error body; fall back to status text.
        let detail = `Server error ${res.status}`;
        try {
          const errJson = (await res.json()) as ApiResponse;
          detail = errJson.error ?? detail;
        } catch { /* response wasn't JSON */ }
        setErrorMessage(detail);
        setFormStatus("error");
        return;
      }

      const json = (await res.json()) as ApiResponse;

      if (json.correlationId && json.result) {
        setResults({
          correlationId:          json.correlationId,
          optimizedResumeContent: json.result.optimizedResumeContent,
          optimizedCoverLetter:   json.result.optimizedCoverLetter,
          interviewCheatsheet:    json.result.interviewCheatsheet,
          reportMarkdown:         json.result.reportMarkdown,
          fitScore:               json.result.fitScore,
          warnings:               json.result.warnings,
        });
      }
      setFormStatus("success");
    } catch {
      setErrorMessage("Network error — please check your connection and try again.");
      setFormStatus("error");
    }
  }

  if (formStatus === "success" && results) {
    return (
      <ResultsView
        data={results}
        onReset={() => {
          setFormStatus("idle");
          setResults(null);
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
      {formStatus === "loading" && <LoadingPanel />}

      {/* Error message */}
      {formStatus === "error" && errorMessage && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            background: "color-mix(in srgb, var(--state-error) 10%, transparent)",
            borderColor: "var(--state-error)",
            color: "var(--state-error)",
          }}
        >
          {errorMessage}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={formStatus === "loading"}
          style={{ background: "var(--accent-primary)", color: "#fff" }}
        >
          {formStatus === "loading" ? "Optimizing…" : "Optimize Resume"}
        </Button>
      </div>
    </form>
  );
}
