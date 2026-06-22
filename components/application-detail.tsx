"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Sparkles, Link2, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  statusStyle,
  fitScoreStyle,
} from "@/lib/applications/status";
import { DocumentPanel } from "@/components/document-panel";
import { CompanyCard } from "@/components/company-card";
import { WarningsSection } from "@/components/warnings-section";
import { ApplicationChat } from "@/components/application-chat";
import type { ChatMessage } from "@/lib/sync/chat";
import type { CompanyResearch, JobDetails } from "@/lib/state/resumeState";

export interface ApplicationMeta {
  id: string;
  slug: string;
  company: string;
  role: string | null;
  jobUrl: string | null;
  location: string | null;
  salary: string | null;
  status: string;
}

export interface ApplicationContentData {
  jd: string | null;
  resume: string | null;
  coverLetter: string | null;
  review: string | null;
  report: string | null;
  interview: string | null;
  chat: ChatMessage[];
}

export interface ApplicationInsightsData {
  companyResearch: CompanyResearch | null;
  jobDetails:      JobDetails | null;
  fitScore:        number | null;
  warnings:        string[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* non-secure context */ }
  }
  return (
    <Button
      variant="outline" size="sm" onClick={handleCopy}
      className="gap-1.5 text-xs"
      style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function ContentPanel({ content, placeholder }: { content: string | null; placeholder: string }) {
  if (!content) {
    return <p className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>{placeholder}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end"><CopyButton text={content} /></div>
      <pre
        className="overflow-auto rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono"
        style={{ background: "var(--bg-base)", borderColor: "var(--border-default)", color: "var(--text-primary)", maxHeight: "64vh" }}
      >
        {content}
      </pre>
    </div>
  );
}

function BadgeRow({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <Badge
            key={i}
            variant="outline"
            className="text-xs font-normal px-2 py-0.5"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)", background: "var(--bg-base)" }}
          >
            {t}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/** "Important for the role" — distilled requirements from the latest run's JD analysis. */
function ImportantForRole({ jobDetails }: { jobDetails: JobDetails }) {
  const jd = jobDetails;
  const flags = [
    jd.securityClearance ? `Security clearance: ${jd.securityClearance}` : null,
    jd.citizenshipRequired ? `Citizenship: ${jd.citizenshipRequired}` : null,
  ].filter(Boolean) as string[];

  const hasContent =
    jd.requiredSkills.length || jd.preferredSkills.length || jd.keywords.length ||
    jd.responsibilities.length || flags.length;
  if (!hasContent) return null;

  return (
    <div
      className="rounded-lg border p-5 flex flex-col gap-4"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--accent-primary)" }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Important for the role
        </h3>
      </div>

      {flags.length > 0 && (
        <ul className="flex flex-col gap-1">
          {flags.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--state-warning)" }}>
              <AlertTriangle className="size-3.5 shrink-0" /> {f}
            </li>
          ))}
        </ul>
      )}

      <BadgeRow label="Required skills" items={jd.requiredSkills} />
      <BadgeRow label="Preferred skills" items={jd.preferredSkills} />
      <BadgeRow label="ATS keywords" items={jd.keywords} />

      {jd.responsibilities.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>Key responsibilities</p>
          <ul className="flex flex-col gap-1">
            {jd.responsibilities.slice(0, 6).map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "var(--accent-primary)" }} />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ApplicationDetail({
  application,
  content,
  insights,
}: {
  application: ApplicationMeta;
  content: ApplicationContentData;
  insights: ApplicationInsightsData;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(application.status);
  const [run, setRun] = useState<"idle" | "running" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    setMessage("Syncing folder ↔ database…");
    try {
      const res = await fetch(`/api/applications/${application.id}/sync`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || `Sync failed (${res.status})`);
      setMessage("Synced — folder and metadata are up to date.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function changeStatus(next: string) {
    setStatus(next);
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setStatus(application.status); // revert on failure
    }
  }

  async function rerun() {
    setRun("running");
    setMessage("Running agents… this can take up to a minute.");
    try {
      const res = await fetch(`/api/applications/${application.id}/optimize`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      const correlationId: string = data.correlationId;

      // Poll the shared result endpoint until the run finishes.
      for (let i = 0; i < 80; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const poll = await fetch(`/api/optimize/result/${correlationId}`);
        if (poll.status === 202) continue;            // still RUNNING
        if (!poll.ok) throw new Error("Optimization failed during the run.");
        break;                                         // DONE
      }
      setRun("idle");
      setMessage("Done — files written to the folder.");
      router.refresh();
    } catch (err) {
      setRun("error");
      setMessage(err instanceof Error ? err.message : "Re-run failed");
    }
  }

  const tabs = [
    { value: "jd",        label: "JD",           content: content.jd,          placeholder: "No JD.md in this folder." },
    { value: "resume",    label: "Resume",       content: content.resume,      placeholder: "No Resume.md yet — run the agents to generate one." },
    { value: "cover",     label: "Cover Letter", content: content.coverLetter, placeholder: "No CoverLetter.md yet." },
    { value: "review",    label: "Review",       content: content.review,      placeholder: "No REVIEW.md (recruiter critique) in this folder." },
    { value: "report",    label: "Report",       content: content.report,      placeholder: "No REPORT.md yet — generated when the agents run." },
    { value: "interview", label: "Interview",    content: content.interview,   placeholder: "No INTERVIEW.md yet — generated when the agents run." },
    { value: "chat",      label: "AI Chat",      content: null,                placeholder: "" },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {application.company}
          </h1>
          {application.role && (
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{application.role}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-faint)" }}>
            <span className="font-mono">{application.slug}/</span>
            {application.location && <span>{application.location}</span>}
            {application.salary && <span>{application.salary}</span>}
            {application.jobUrl && (
              <a href={application.jobUrl} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1" style={{ color: "var(--accent-primary)" }}>
                <Link2 className="size-3" /> Job post <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {insights.fitScore !== null && (
            <Badge variant="outline" className="text-xs font-semibold px-2" style={fitScoreStyle(insights.fitScore)}>
              Fit {insights.fitScore}/100
            </Badge>
          )}
          <Badge variant="outline" className="text-xs font-semibold px-2" style={statusStyle(status)}>
            {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
          </Badge>
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
            className="h-8 rounded-md border px-2 text-xs"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            aria-label="Application status"
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <Button
            variant="outline" size="sm" onClick={sync} disabled={syncing}
            className="gap-1.5 text-xs h-8"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync"}
          </Button>
          <Button
            size="sm" onClick={rerun} disabled={run === "running"}
            className="gap-1.5 text-xs h-8 shadow-[0_8px_24px_-6px_rgba(104,67,236,0.55)]"
            style={{ background: "var(--accent-gradient)", color: "var(--text-on-accent)" }}
          >
            <Sparkles className={`size-3.5 ${run === "running" ? "animate-pulse" : ""}`} />
            {run === "running" ? "Running…" : "Re-run agents"}
          </Button>
        </div>
      </div>

      {message && (
        <p className="text-xs" style={{ color: run === "error" ? "var(--state-error)" : "var(--text-muted)" }}>
          {message}
        </p>
      )}

      {/* Insights from the latest optimization run */}
      <WarningsSection warnings={insights.warnings} />
      {insights.jobDetails && <ImportantForRole jobDetails={insights.jobDetails} />}
      {insights.companyResearch && <CompanyCard research={insights.companyResearch} />}

      {/* Tabs */}
      <Tabs defaultValue="jd" className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {t.value === "resume" ? (
              <DocumentPanel
                appId={application.id}
                markdown={content.resume}
                basePath="resume"
                emptyLabel={t.placeholder}
              />
            ) : t.value === "cover" ? (
              <DocumentPanel
                appId={application.id}
                markdown={content.coverLetter}
                basePath="cover-letter"
                emptyLabel={t.placeholder}
              />
            ) : t.value === "chat" ? (
              <ApplicationChat appId={application.id} initial={content.chat} />
            ) : (
              <ContentPanel content={t.content} placeholder={t.placeholder} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
