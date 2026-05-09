/**
 * lib/state/resumeState.ts
 *
 * Single source of truth for the LangGraph.js agent workflow state.
 *
 * Rules (from architecture.md invariants):
 *  - Agent nodes return Partial<ResumeJobState> — never the full state.
 *  - Every node must include updateAgentStatus(...) in its return.
 *  - PII (resume text, cover letter) lives here only during the run;
 *    it is never written to PostgreSQL columns.
 */

// ─── Agent names ──────────────────────────────────────────────────────────────
// Typed union so passing a misspelled agent name is a compile error.

export type AgentName =
  | "inputParser"
  | "jobAgent"
  | "companyAgent"
  | "resumeAnalyzer"
  | "strategyAgent"
  | "resumeWriter"
  | "coverLetterWriter"
  | "finalCompiler";

// ─── AgentStatus ──────────────────────────────────────────────────────────────
// String enum so values are readable in SSE events, logs, and the DB JSON blob.

export enum AgentStatus {
  Pending   = "pending",
  Running   = "running",
  Completed = "completed",
  Failed    = "failed",
}

export interface AgentStatusRecord {
  status:    AgentStatus;
  startedAt: number | null; // epoch ms — set when Running
  endedAt:   number | null; // epoch ms — set when Completed or Failed
  message:   string | null; // last log line or error summary
}

export type AgentStatusMap = Record<AgentName, AgentStatusRecord>;

// ─── Research sub-types ───────────────────────────────────────────────────────

export interface JobDetails {
  title:            string;
  company:          string;
  seniority:        string;       // "Junior" | "Senior" | "Staff" | "Principal" | …
  responsibilities: string[];
  requiredSkills:   string[];
  preferredSkills:  string[];
  keywords:         string[];     // ATS-critical keywords extracted from the JD
  salary:           string | null;
  remote:           boolean | null;
  rawText:          string;       // full scraped JD text — passed to downstream agents
}

export interface CompanyResearch {
  name:         string;
  website:      string | null;
  mission:      string | null;
  values:       string[];         // stated company values
  recentNews:   string[];         // brief summaries of recent press / blog posts
  techStack:    string[];         // inferred from job posts + eng blog
  cultureNotes: string;           // free-form synthesis for the cover letter writer
}

export interface ResumeAnalysis {
  atsScore:        number;        // 0–100 baseline score
  keywordOverlap:  string[];      // JD keywords already in the resume
  missingKeywords: string[];      // JD keywords absent from the resume
  weakVerbs:       string[];      // verbs flagged for STAR-method upgrade
  strengths:       string[];      // strong bullets / experiences to preserve
  gaps:            string[];      // experience gaps vs the JD
}

export interface TailoringStrategy {
  fitScore:      number;          // 0–100 overall fit estimate
  gaps:          Array<{ title: string; detail: string }>;
  plan:          string[];        // ordered steps the writer agents must follow
  keywordsToAdd: string[];        // must appear in optimized resume Summary + Skills
}

// ─── ResumeJobState ───────────────────────────────────────────────────────────

export interface ResumeJobState {
  // ── Run identity ────────────────────────────────────────────────────────
  correlationId: string;

  // ── Inputs ──────────────────────────────────────────────────────────────
  resumeText:         string;  // parsed resume (Markdown / plain text)
  coverLetterText:    string;  // optional draft; empty string if not provided
  jobUrl:             string;
  jobDescriptionText: string;  // optional paste-in; empty string if not provided
  companyUrl:         string;  // optional; empty string if not provided
  companyName:        string;  // may be empty — inferred by jobAgent

  // ── Parallel research outputs ────────────────────────────────────────────
  jobDetails:      JobDetails      | null;
  companyResearch: CompanyResearch | null;
  resumeAnalysis:  ResumeAnalysis  | null;

  // ── Synthesis ────────────────────────────────────────────────────────────
  tailoringStrategy: TailoringStrategy | null;

  // ── Final outputs ────────────────────────────────────────────────────────
  optimizedResumeContent: string | null;
  optimizedCoverLetter:   string | null;
  interviewCheatsheet:    string | null;
  reportMarkdown:         string | null;
  reportArtifactUrl:      string | null; // blob URL to PDF/ZIP package

  // ── Cross-cutting ─────────────────────────────────────────────────────────
  agentStatus: AgentStatusMap;
  warnings:    string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_AGENT_STATUS: AgentStatusRecord = {
  status:    AgentStatus.Pending,
  startedAt: null,
  endedAt:   null,
  message:   null,
};

/**
 * Returns the initial default agent status map.
 * Every agent starts as Pending — the graph runner sets them Running/Completed.
 */
export function initialAgentStatusMap(): AgentStatusMap {
  return {
    inputParser:       { ...DEFAULT_AGENT_STATUS },
    jobAgent:          { ...DEFAULT_AGENT_STATUS },
    companyAgent:      { ...DEFAULT_AGENT_STATUS },
    resumeAnalyzer:    { ...DEFAULT_AGENT_STATUS },
    strategyAgent:     { ...DEFAULT_AGENT_STATUS },
    resumeWriter:      { ...DEFAULT_AGENT_STATUS },
    coverLetterWriter: { ...DEFAULT_AGENT_STATUS },
    finalCompiler:     { ...DEFAULT_AGENT_STATUS },
  };
}

/**
 * Creates a fully-populated initial state for a new optimization run.
 * Required fields: correlationId, resumeText, jobUrl.
 * All other fields default to null / empty.
 */
export function createInitialState(
  required: Pick<ResumeJobState, "correlationId" | "resumeText" | "jobUrl"> &
    Partial<ResumeJobState>
): ResumeJobState {
  return {
    coverLetterText:        "",
    jobDescriptionText:     "",
    companyUrl:             "",
    companyName:            "",
    jobDetails:             null,
    companyResearch:        null,
    resumeAnalysis:         null,
    tailoringStrategy:      null,
    optimizedResumeContent: null,
    optimizedCoverLetter:   null,
    interviewCheatsheet:    null,
    reportMarkdown:         null,
    reportArtifactUrl:      null,
    warnings:               [],
    agentStatus:            initialAgentStatusMap(),
    ...required,
  };
}

/**
 * Produces the agentStatus delta that every node must include in its return.
 *
 * IMPORTANT — delta semantics:
 *   Returns ONLY { [agent]: record }, not the full AgentStatusMap.
 *   The LangGraph graph annotation uses a per-key merge reducer, so two
 *   parallel nodes each returning their own delta are merged safely:
 *     jobAgent   returns { agentStatus: { jobAgent:   { completed } } }
 *     companyAgent returns { agentStatus: { companyAgent: { completed } } }
 *     reducer:   { ...prev, jobAgent: ..., companyAgent: ... }  ✓
 *
 *   If each node returned the full spread ({ ...state.agentStatus, [agent]: ... }),
 *   the last node to finish would overwrite the other's Completed back to Pending.
 *
 * Usage inside a node:
 *   return {
 *     jobDetails: parsed,
 *     ...updateAgentStatus(state, "jobAgent", AgentStatus.Completed),
 *   };
 */
export function updateAgentStatus(
  state: ResumeJobState,
  agent: AgentName,
  status: AgentStatus,
  message?: string
): Pick<ResumeJobState, "agentStatus"> {
  const now = Date.now();
  const prev = state.agentStatus[agent];

  // Cast required: we intentionally return a single-key partial record.
  // The LangGraph reducer handles the merge; TypeScript sees AgentStatusMap.
  return {
    agentStatus: {
      [agent]: {
        status,
        startedAt: status === AgentStatus.Running ? now : (prev?.startedAt ?? null),
        endedAt:   status === AgentStatus.Completed || status === AgentStatus.Failed ? now : null,
        message:   message ?? prev?.message ?? null,
      } satisfies AgentStatusRecord,
    } as AgentStatusMap,
  };
}

/**
 * Returns a single-item warnings delta. Spread it alongside your other fields.
 *
 * IMPORTANT — delta semantics:
 *   Returns only [message], not the accumulated array.
 *   The LangGraph concat reducer appends it to the existing warnings.
 *
 * Usage:
 *   return {
 *     companyResearch: fallback,
 *     ...appendWarning(state, "[companyAgent] Could not scrape about page"),
 *     ...updateAgentStatus(state, "companyAgent", AgentStatus.Completed),
 *   };
 */
export function appendWarning(
  _state: ResumeJobState,
  message: string
): Pick<ResumeJobState, "warnings"> {
  // Single-item array — the LangGraph concat reducer handles accumulation.
  return { warnings: [message] };
}
