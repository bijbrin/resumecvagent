"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AgentStatus,
  type AgentName,
  type AgentStatusMap,
} from "@/lib/state/resumeState";

// ── Agent catalogue ──────────────────────────────────────────────────────────
// Order, codes, stages and parallelism mirror the real backend graph (do not
// reorder — the Flow columns depend on the stage grouping).
interface AgentDef {
  name: AgentName;
  code: string;
  label: string;
  stage: number;
  /** Nominal seconds — used only to animate the in-flight progress bar. */
  nominal: number;
  act: string;
}

const AGENTS: AgentDef[] = [
  { name: "inputParser", code: "IP", label: "Input Parser", stage: 1, nominal: 1.6, act: "Parsing job + resume" },
  { name: "jobAgent", code: "JB", label: "Job Agent", stage: 2, nominal: 2.6, act: "Extracting requirements" },
  { name: "companyAgent", code: "CR", label: "Company Research", stage: 2, nominal: 3.1, act: "Researching the company" },
  { name: "resumeAnalyzer", code: "RA", label: "Resume Analyzer", stage: 2, nominal: 2.3, act: "Scoring resume vs role" },
  { name: "strategyAgent", code: "ST", label: "Strategy Agent", stage: 3, nominal: 2.0, act: "Synthesizing positioning" },
  { name: "resumeWriter", code: "RW", label: "Resume Writer", stage: 4, nominal: 2.3, act: "Rewriting for ATS + impact" },
  { name: "coverLetterWriter", code: "CW", label: "Cover Letter Writer", stage: 4, nominal: 2.0, act: "Drafting cover letter" },
  { name: "finalCompiler", code: "FC", label: "Final Compiler", stage: 5, nominal: 1.6, act: "Compiling deliverables" },
];

const STAGE_LABELS: Record<number, string> = {
  1: "01 · Parse",
  2: "02 · Analyze · parallel",
  3: "03 · Strategy",
  4: "04 · Write · parallel",
  5: "05 · Compile",
};

type VisualStatus = "pending" | "active" | "done" | "error";

interface AgentView {
  name: AgentName;
  code: string;
  label: string;
  stage: number;
  stageTag: string;
  desc: string;
  statusLabel: string;
  status: VisualStatus;
  barPct: number;
  cardOpacity: number;
  cardBorder: string;
  cardGlow: string;
  codeBg: string;
  codeColor: string;
  dotColor: string;
  barColor: string;
  barAnim: string;
  badgeAnim: string;
  segGlow: string;
}

function toVisual(status: AgentStatus | undefined): VisualStatus {
  switch (status) {
    case AgentStatus.Running:
      return "active";
    case AgentStatus.Completed:
      return "done";
    case AgentStatus.Failed:
      return "error";
    default:
      return "pending";
  }
}

function deriveView(def: AgentDef, map: AgentStatusMap | null, now: number): AgentView {
  const rec = map?.[def.name];
  const vs = toVisual(rec?.status);

  let p = 0;
  if (vs === "done" || vs === "error") p = 1;
  else if (vs === "active") {
    const started = rec?.startedAt ?? now;
    p = Math.min(0.96, Math.max(0.06, (now - started) / 1000 / def.nominal));
  }
  const barPct = Math.round(p * 100);

  const errorColor = "var(--state-error)";
  return {
    name: def.name,
    code: def.code,
    label: def.label,
    stage: def.stage,
    stageTag: `Stage ${def.stage}`,
    desc:
      vs === "active" ? (rec?.message ?? def.act) : vs === "done" ? "Completed" : vs === "error" ? "Failed" : "Queued",
    statusLabel: vs === "done" ? "Done" : vs === "active" ? "Running" : vs === "error" ? "Failed" : "Queued",
    status: vs,
    barPct,
    cardOpacity: vs === "pending" ? 0.5 : 1,
    cardBorder:
      vs === "active" ? "var(--accent)" : vs === "error" ? errorColor : vs === "done" ? "var(--border-strong)" : "var(--border-default)",
    cardGlow: vs === "active" ? "0 0 0 1px var(--accent-line), 0 14px 44px var(--accent-glow)" : "none",
    codeBg: vs === "active" ? "var(--accent-soft)" : vs === "done" ? "rgba(63,207,142,.12)" : vs === "error" ? "rgba(239,68,68,.12)" : "rgba(255,255,255,.05)",
    codeColor: vs === "active" ? "var(--accent)" : vs === "done" ? "var(--ok)" : vs === "error" ? errorColor : "var(--text-muted)",
    dotColor: vs === "active" ? "var(--accent)" : vs === "done" ? "var(--ok)" : vs === "error" ? errorColor : "#3a3d46",
    barColor: vs === "done" ? "var(--ok)" : vs === "error" ? errorColor : "var(--accent)",
    barAnim: vs === "active" ? "barpulse 1.3s ease-in-out infinite" : "none",
    badgeAnim: vs === "active" ? "badgepulse 1.8s ease-out infinite" : "none",
    segGlow: vs === "active" ? "0 0 12px var(--accent-glow)" : "none",
  };
}

// ── Log model ────────────────────────────────────────────────────────────────
type LogKind = "start" | "done" | "info" | "error";
interface LogLine {
  key: string;
  ts: number;
  kind: LogKind;
  text: string;
}
const mark = (k: LogKind) => (k === "done" ? "✓" : k === "start" ? "▸" : k === "error" ? "✕" : "·");
const markColor = (k: LogKind) =>
  k === "done" ? "var(--ok)" : k === "start" ? "var(--accent)" : k === "error" ? "var(--state-error)" : "var(--text-faint)";

type PipelineStyle = "flow" | "timeline" | "segments";

interface AgentPipelineProps {
  agentStatus: AgentStatusMap | null;
  startedAt: number;
  complete: boolean;
  fitScore: number | null;
  atsScore?: number | null;
  warnings: string[];
  onReplay?: () => void;
  onViewResults?: () => void;
}

const RING_C = 263.9; // 2πr, r=42

export function AgentPipeline({
  agentStatus,
  startedAt,
  complete,
  fitScore,
  atsScore,
  warnings,
  onReplay,
  onViewResults,
}: AgentPipelineProps) {
  const [style, setStyle] = useState<PipelineStyle>("flow");
  const [now, setNow] = useState<number>(() => Date.now());
  const logRef = useRef<HTMLDivElement>(null);

  // Tick "now" while the run is live so in-flight bars + elapsed advance smoothly.
  // setState lives in the interval callback (not the effect body) — safe.
  useEffect(() => {
    if (complete) return;
    const iv = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(iv);
  }, [complete]);

  // The log is derived purely from the real agent-status timestamps — every
  // start/end line is ordered by the actual startedAt / endedAt the stream
  // reports, so it stays bound to live data with no accumulator state.
  const logs = useMemo<LogLine[]>(() => {
    const out: LogLine[] = [];
    for (const def of AGENTS) {
      const rec = agentStatus?.[def.name];
      if (!rec) continue;
      if (rec.startedAt != null) {
        out.push({ key: `${def.name}:s`, ts: rec.startedAt, kind: "start", text: `${def.label} · ${rec.message ?? def.act}` });
      }
      if (rec.endedAt != null) {
        const failed = rec.status === AgentStatus.Failed;
        out.push({ key: `${def.name}:e`, ts: rec.endedAt, kind: failed ? "error" : "done", text: `${def.label} · ${failed ? "failed" : "done"}` });
      }
    }
    out.sort((a, b) => a.ts - b.ts);
    const base = Number.MAX_SAFE_INTEGER - warnings.length - 1;
    warnings.forEach((w, i) => out.push({ key: `warn:${i}`, ts: base + i, kind: "info", text: w }));
    if (complete) {
      out.push({ key: "complete", ts: Number.MAX_SAFE_INTEGER, kind: "done", text: `All materials ready${fitScore != null ? ` · fit score ${fitScore}` : ""}` });
    }
    return out;
  }, [agentStatus, warnings, complete, fitScore]);

  // Auto-scroll the terminal to the bottom (scrollHeight, not scrollIntoView).
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs.length]);

  const views = useMemo(() => AGENTS.map((d) => deriveView(d, agentStatus, now)), [agentStatus, now]);

  const doneCount = views.filter((v) => v.status === "done").length;
  const overall = complete ? 100 : Math.round((views.reduce((s, v) => s + v.barPct, 0) / views.length));
  const ringOffset = (RING_C * (1 - overall / 100)).toFixed(1);
  const elapsed = Math.max(0, (now - startedAt) / 1000);

  const stages = useMemo(() => {
    const order = [1, 2, 3, 4, 5];
    return order.map((stage) => ({ stage, agents: views.filter((v) => v.stage === stage) }));
  }, [views]);

  const termHeight = style === "segments" ? 330 : 224;

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      {/* Header */}
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-[7px]">
          <div className="flex items-center gap-[9px]">
            <span
              className={complete ? "h-2 w-2 rounded-full" : "h-2 w-2 rounded-full animate-livedot"}
              style={{ background: "var(--accent)", boxShadow: "0 0 10px var(--accent)" }}
            />
            <span className="font-mono text-[11px]" style={{ letterSpacing: "0.14em", color: "var(--accent)" }}>
              {complete ? "Pipeline complete" : "Agents working"}
            </span>
          </div>
          <h2 className="m-0 text-[23px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-primary)" }}>
            Multi-agent pipeline
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex gap-[3px] rounded-[11px] p-[3px]"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--border-default)" }}
            role="tablist"
            aria-label="Pipeline visualization"
          >
            {([["flow", "Flow"], ["timeline", "Timeline"], ["segments", "Stream"]] as const).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={style === k}
                onClick={() => setStyle(k)}
                className="cursor-pointer rounded-[8px] px-[13px] py-[7px] font-mono text-[11px] transition-colors"
                style={{
                  letterSpacing: "0.04em",
                  background: style === k ? "var(--surface-2)" : "transparent",
                  color: style === k ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                {l}
              </button>
            ))}
          </div>
          {onReplay && (
            <button
              type="button"
              onClick={onReplay}
              className="flex items-center gap-[7px] rounded-[10px] px-[13px] py-2 font-mono text-[11px] cursor-pointer transition-colors"
              style={{ border: "1px solid var(--border-strong)", background: "rgba(255,255,255,.02)", color: "var(--text-secondary)", letterSpacing: "0.03em" }}
            >
              ↻ Replay
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col items-start gap-5 lg:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          {/* Viz panel */}
          <div
            className="rounded-[18px] p-[22px]"
            style={{ background: "color-mix(in srgb, var(--surface) 58%, transparent)", border: "1px solid var(--border-default)" }}
            aria-live="polite"
          >
            {style === "flow" && <FlowViz stages={stages} />}
            {style === "timeline" && <TimelineViz views={views} />}
            {style === "segments" && <SegmentsViz views={views} />}
          </div>

          {/* Log terminal */}
          <div
            className="flex flex-col overflow-hidden rounded-[16px]"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--border-default)" }}
          >
            <div
              className="flex items-center gap-2.5 px-4 py-[11px]"
              style={{ borderBottom: "1px solid var(--border-default)", background: "rgba(255,255,255,.015)" }}
            >
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: "#3a3d46" }} />
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: "#3a3d46" }} />
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: "#3a3d46" }} />
              <span className="ml-1.5 font-mono text-[10.5px]" style={{ letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                agent-stream.log
              </span>
              <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px]" style={{ color: "var(--accent)" }}>
                <span className={complete ? "h-1.5 w-1.5 rounded-full" : "h-1.5 w-1.5 rounded-full animate-livedot"} style={{ background: "var(--accent)" }} />
                {complete ? "DONE" : "LIVE"}
              </span>
            </div>
            <div
              ref={logRef}
              role="log"
              aria-live="polite"
              className="flex flex-col gap-0.5 overflow-y-auto px-[18px] py-3.5"
              style={{ height: termHeight }}
            >
              {logs.map((line) => (
                <div key={line.key} className="flex items-baseline gap-[11px] animate-stream-in font-mono text-[12.5px] leading-[1.75]">
                  <span className="w-[11px] flex-none" style={{ color: markColor(line.kind) }}>{mark(line.kind)}</span>
                  <span style={{ color: "#B4B7C1" }}>{line.text}</span>
                </div>
              ))}
              {!complete && (
                <div className="flex items-baseline gap-[11px] font-mono text-[12.5px] leading-[1.75]">
                  <span className="w-[11px] flex-none" style={{ color: "var(--accent)" }}>›</span>
                  <span className="inline-block h-[15px] w-2 animate-blink" style={{ background: "var(--accent)" }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status rail */}
        <aside className="flex w-full flex-none flex-col gap-4 lg:w-[300px]">
          <div
            className="flex flex-col items-center gap-4 rounded-[18px] p-[22px]"
            style={{ background: "color-mix(in srgb, var(--surface) 60%, transparent)", border: "1px solid var(--border-default)" }}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-mono text-[10.5px]" style={{ letterSpacing: "0.14em", color: "var(--text-muted)" }}>RUN STATUS</span>
              <span className="font-mono text-[10.5px]" style={{ color: "var(--accent)" }}>{elapsed.toFixed(1)}s</span>
            </div>
            <div className="relative flex h-[140px] w-[140px] items-center justify-center">
              <svg width="140" height="140" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
                <circle
                  cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={RING_C} strokeDashoffset={ringOffset} style={{ transition: "stroke-dashoffset .3s linear" }}
                />
              </svg>
              <div className="absolute flex flex-col items-center leading-none">
                <span className="text-[30px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-primary)" }}>
                  {overall}
                  <span className="text-[15px]" style={{ color: "var(--text-muted)" }}>%</span>
                </span>
                <span className="mt-[5px] font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {doneCount} / {AGENTS.length} agents
                </span>
              </div>
            </div>
          </div>

          {complete ? (
            <div
              className="flex flex-col gap-4 rounded-[18px] p-[22px]"
              style={{ background: "color-mix(in srgb, var(--surface) 60%, transparent)", border: "1px solid var(--accent-line)", boxShadow: "var(--shadow-glow)" }}
            >
              <span className="font-mono text-[10.5px]" style={{ letterSpacing: "0.14em", color: "var(--accent)" }}>RESULTS READY</span>
              <div className="flex flex-col gap-[13px]">
                {atsScore != null && <ScoreBar label="ATS score" value={atsScore} color="var(--ok)" />}
                {fitScore != null && <ScoreBar label="Role fit" value={fitScore} color="var(--accent)" />}
              </div>
              <div className="flex flex-wrap gap-[7px]">
                {["MD", "PDF", "DOCX"].map((f) => (
                  <span key={f} className="font-mono text-[10px] rounded-[7px] px-[9px] py-[5px]" style={{ color: "var(--text-secondary)", border: "1px solid var(--border-strong)" }}>{f}</span>
                ))}
              </div>
              {onViewResults && (
                <button
                  type="button"
                  onClick={onViewResults}
                  className="flex w-full items-center justify-center gap-2 rounded-[11px] py-[13px] text-[14px] font-semibold cursor-pointer"
                  style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                >
                  View results →
                </button>
              )}
            </div>
          ) : (
            <div
              className="flex items-start gap-3 rounded-[18px] p-5"
              style={{ background: "color-mix(in srgb, var(--surface) 60%, transparent)", border: "1px solid var(--border-default)" }}
            >
              <span className="text-[14px] leading-[1.3]" style={{ color: "var(--accent)" }}>◆</span>
              <div className="flex flex-col gap-[5px]">
                <span className="text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>Streaming live</span>
                <p className="m-0 text-[12.5px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
                  Outputs build incrementally as agents finish — no waiting on the whole run.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="font-mono text-[15px]" style={{ color }}>{Math.round(value)}</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-[20px]" style={{ background: "rgba(255,255,255,.06)" }}>
        <div className="h-full rounded-[20px]" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Flow ─────────────────────────────────────────────────────────────────────
function FlowViz({ stages }: { stages: Array<{ stage: number; agents: AgentView[] }> }) {
  return (
    <div className="flex items-stretch gap-0 overflow-x-auto px-0.5 pb-2 pt-1">
      {stages.map((col, i) => (
        <div key={col.stage} className="flex items-stretch gap-0">
          <div className="flex flex-none flex-col gap-3">
            <div className="font-mono text-[10px] uppercase pl-0.5" style={{ letterSpacing: "0.1em", color: "var(--text-faint)" }}>
              {STAGE_LABELS[col.stage]}
            </div>
            {col.agents.map((a) => (
              <AgentCard key={a.name} a={a} width={col.stage === 2 ? 200 : col.stage === 4 ? 196 : 184} />
            ))}
          </div>
          {i < stages.length - 1 && (
            <div
              className="h-[2px] w-[34px] flex-none self-center animate-flowx"
              style={{
                background: "repeating-linear-gradient(90deg, var(--accent-line) 0 5px, transparent 5px 12px)",
                opacity: 0.55,
                marginInline: 12,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function AgentCard({ a, width }: { a: AgentView; width: number }) {
  return (
    <div
      className="flex flex-none flex-col gap-[9px] rounded-[14px] px-3.5 py-[13px]"
      style={{ width, background: "var(--surface)", border: `1px solid ${a.cardBorder}`, opacity: a.cardOpacity, boxShadow: a.cardGlow, transition: "all .35s ease" }}
    >
      <div className="flex items-center justify-between">
        <span
          className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] font-mono text-[12px] font-semibold"
          style={{ background: a.codeBg, color: a.codeColor, animation: a.badgeAnim }}
        >
          {a.code}
        </span>
        <span className="font-mono text-[9px] uppercase rounded-[20px] px-2 py-[3px]" style={{ letterSpacing: "0.08em", background: a.codeBg, color: a.codeColor }}>
          {a.statusLabel}
        </span>
      </div>
      <div className="text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>{a.label}</div>
      <div className="font-mono text-[11px] min-h-[15px]" style={{ color: "#6B6E78" }}>{a.desc}</div>
      <ProgressTrack a={a} />
    </div>
  );
}

function ProgressTrack({ a }: { a: AgentView }) {
  return (
    <div className="h-1 overflow-hidden rounded-[20px]" style={{ background: "rgba(255,255,255,.06)" }}>
      <div className="h-full rounded-[20px]" style={{ width: `${a.barPct}%`, background: a.barColor, animation: a.barAnim, transition: "width .3s linear" }} />
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────
function TimelineViz({ views }: { views: AgentView[] }) {
  return (
    <div className="flex flex-col">
      {views.map((a, i) => (
        <div key={a.name} className="flex gap-4">
          <div className="flex w-4 flex-none flex-col items-center">
            <span className="h-3.5 w-3.5 flex-none rounded-full" style={{ background: a.dotColor, boxShadow: "0 0 0 4px rgba(255,255,255,.03)", animation: a.badgeAnim }} />
            {i < views.length - 1 && <span className="my-[5px] min-h-[14px] w-0.5 flex-1" style={{ background: "rgba(255,255,255,.08)" }} />}
          </div>
          <div
            className="mb-3 flex flex-1 items-center gap-3.5 rounded-[12px] px-4 py-[13px]"
            style={{ background: "var(--surface)", border: `1px solid ${a.cardBorder}`, opacity: a.cardOpacity, boxShadow: a.cardGlow, transition: "all .35s ease" }}
          >
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] font-mono text-[12px] font-semibold" style={{ background: a.codeBg, color: a.codeColor }}>
              {a.code}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>{a.label}</span>
                <span className="font-mono text-[9.5px]" style={{ letterSpacing: "0.06em", color: "var(--text-faint)" }}>{a.stageTag}</span>
              </div>
              <div className="mt-[3px] font-mono text-[11px]" style={{ color: "#6B6E78" }}>{a.desc}</div>
            </div>
            <div className="flex w-[120px] flex-none flex-col items-end gap-1.5">
              <span className="font-mono text-[9px] uppercase" style={{ letterSpacing: "0.08em", color: a.codeColor }}>{a.statusLabel}</span>
              <div className="h-1 w-full"><ProgressTrack a={a} /></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Segments / Stream ────────────────────────────────────────────────────────
function SegmentsViz({ views }: { views: AgentView[] }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex gap-1.5">
        {views.map((a) => (
          <div key={a.name} className="flex flex-1 flex-col items-center gap-[7px]">
            <div className="h-2.5 w-full overflow-hidden rounded-[7px]" style={{ background: "rgba(255,255,255,.06)", boxShadow: a.segGlow }}>
              <div className="h-full rounded-[7px]" style={{ width: `${a.barPct}%`, background: a.barColor, transition: "width .3s linear" }} />
            </div>
            <span className="font-mono text-[10px]" style={{ color: a.codeColor }}>{a.code}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {views.map((a) => (
          <div
            key={a.name}
            className="flex items-center gap-[9px] rounded-[11px] px-3 py-2.5"
            style={{ background: "var(--surface)", border: `1px solid ${a.cardBorder}`, opacity: a.cardOpacity, transition: "all .3s" }}
          >
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: a.dotColor, animation: a.badgeAnim }} />
            <span className="truncate text-[12.5px]" style={{ color: "var(--text-secondary)" }}>{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
