"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, Copy, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResultsData {
  correlationId:          string;
  optimizedResumeContent: string | null;
  optimizedCoverLetter:   string | null;
  interviewCheatsheet:    string | null;
  reportMarkdown:         string | null;
  fitScore:               number | null;
  warnings:               string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fitScoreStyle(score: number | null): React.CSSProperties {
  if (score === null) return { background: "var(--bg-surface)", color: "var(--text-muted)", borderColor: "var(--border-default)" };
  if (score >= 70)    return { background: "var(--state-success)", color: "#fff", borderColor: "var(--state-success)" };
  if (score >= 50)    return { background: "var(--state-warning, #d97706)", color: "#fff", borderColor: "var(--state-warning, #d97706)" };
  return                     { background: "var(--state-error)", color: "#fff", borderColor: "var(--state-error)" };
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in non-secure contexts — fail silently.
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="gap-1.5 text-xs"
      style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

// ── ContentPanel ──────────────────────────────────────────────────────────────

function ContentPanel({
  content,
  placeholder,
}: {
  content: string | null;
  placeholder: string;
}) {
  if (!content) {
    return (
      <p className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        {placeholder}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <CopyButton text={content} />
      </div>
      <pre
        className="overflow-auto rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono"
        style={{
          background:   "var(--bg-base)",
          borderColor:  "var(--border-default)",
          color:        "var(--text-primary)",
          maxHeight:    "60vh",
        }}
      >
        {content}
      </pre>
    </div>
  );
}

// ── Warnings ──────────────────────────────────────────────────────────────────

function WarningsSection({ warnings }: { warnings: string[] }) {
  const [open, setOpen] = useState(false);

  if (warnings.length === 0) return null;

  return (
    <div
      className="rounded-lg border"
      style={{
        background:  "color-mix(in srgb, var(--state-warning, #d97706) 8%, transparent)",
        borderColor: "color-mix(in srgb, var(--state-warning, #d97706) 40%, transparent)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        style={{ color: "var(--state-warning, #d97706)" }}
      >
        <span>{warnings.length} warning{warnings.length > 1 ? "s" : ""}</span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      {open && (
        <ul className="px-4 pb-3 flex flex-col gap-1">
          {warnings.map((w, i) => (
            <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── ResultsView ───────────────────────────────────────────────────────────────

export function ResultsView({
  data,
  onReset,
}: {
  data: ResultsData;
  onReset: () => void;
}) {
  const tabs = [
    { value: "resume",    label: "Resume",       content: data.optimizedResumeContent, placeholder: "Resume content was not generated." },
    { value: "cover",     label: "Cover Letter",  content: data.optimizedCoverLetter,   placeholder: "Cover letter was not generated."  },
    { value: "interview", label: "Interview Prep",content: data.interviewCheatsheet,    placeholder: "Interview prep was not generated." },
    { value: "report",    label: "Full Report",   content: data.reportMarkdown,          placeholder: "Report was not compiled."         },
  ] as const;

  return (
    <div className="flex flex-col gap-5 w-full max-w-4xl">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold shrink-0"
            style={{ background: "var(--state-success)" }}
          >
            ✓
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
              Optimization complete
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              ID:{" "}
              <code
                className="font-mono select-all"
                style={{ color: "var(--text-secondary)" }}
              >
                {data.correlationId}
              </code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {data.fitScore !== null && (
            <Badge
              variant="outline"
              style={fitScoreStyle(data.fitScore)}
              className="text-xs font-semibold px-2"
            >
              Fit {data.fitScore}/100
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
          >
            Optimize another
          </Button>
        </div>
      </div>

      {/* ── Warnings ──────────────────────────────────────────────────────── */}
      <WarningsSection warnings={data.warnings} />

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="resume" className="w-full">
        <TabsList className="mb-4">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            <ContentPanel content={t.content} placeholder={t.placeholder} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
