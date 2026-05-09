/**
 * lib/graph/resumeBuilder.ts
 *
 * Builds the LangGraph.js state machine for the resume optimization workflow.
 * This file owns the topology — which nodes exist, which edges connect them,
 * and which agent variant (standard vs. Kimi Code) each node uses.
 *
 * Topology:
 *
 *   START
 *     │
 *   inputParser
 *     ├──────────────────────────┐────────────────────────┐
 *   jobAgent              companyAgent             resumeAnalyzer
 *     └──────────────────────────┴────────────────────────┘
 *                                │  (fan-in: all three must complete)
 *                          strategyAgent
 *                     ┌─────────┴──────────┐
 *               resumeWriter       coverLetterWriter
 *                     └─────────┬──────────┘
 *                          finalCompiler
 *                                │
 *                              END
 */

import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import {
  type ResumeJobState,
  type AgentStatusMap,
  type AgentStatusRecord,
  type JobDetails,
  type CompanyResearch,
  type ResumeAnalysis,
  type TailoringStrategy,
  initialAgentStatusMap,
} from "../state/resumeState";

// ─── Agent imports ─────────────────────────────────────────────────────────────
import { inputParserNode }      from "../agents/inputParser";
import { jobAgentNode }         from "../agents/jobAgent";
import { companyAgentNode }     from "../agents/companyAgent";
import { resumeAnalyzerNode }   from "../agents/resumeAnalyzer";
import { strategyAgentNode }    from "../agents/strategyAgent";
import { resumeWriterNode }     from "../agents/resumeWriter";
import { coverLetterWriterNode } from "../agents/coverLetterWriter";
import { finalCompilerNode }    from "../agents/finalCompiler";

// ─── State annotation ──────────────────────────────────────────────────────────
//
// Annotation.Root defines how LangGraph merges partial state updates from nodes.
// Most fields use the default "replace" reducer (last write wins — safe because
// only one agent writes each field).
//
// Two fields need special reducers for parallel-safe accumulation:
//   agentStatus — shallow-merge: each agent returns only its own key delta
//   warnings    — concat: each agent returns only its new warning(s)

// LangGraph 1.x uses `value` (not `reducer`) for the merge function.
// Fields without options use replace semantics (last write wins) —
// safe because only one agent writes each of those fields.
const GraphAnnotation = Annotation.Root({
  // ── Run identity ──────────────────────────────────────────────────────────
  correlationId: Annotation<string>(),

  // ── Inputs ────────────────────────────────────────────────────────────────
  resumeText:         Annotation<string>(),
  coverLetterText:    Annotation<string>(),
  jobUrl:             Annotation<string>(),
  jobDescriptionText: Annotation<string>(),
  companyUrl:         Annotation<string>(),
  companyName:        Annotation<string>(),

  // ── Research outputs (one agent owns each field — replace is safe) ─────────
  jobDetails:      Annotation<JobDetails      | null>(),
  companyResearch: Annotation<CompanyResearch | null>(),
  resumeAnalysis:  Annotation<ResumeAnalysis  | null>(),

  // ── Synthesis ─────────────────────────────────────────────────────────────
  tailoringStrategy: Annotation<TailoringStrategy | null>(),

  // ── Final outputs ─────────────────────────────────────────────────────────
  optimizedResumeContent: Annotation<string | null>(),
  optimizedCoverLetter:   Annotation<string | null>(),
  interviewCheatsheet:    Annotation<string | null>(),
  reportMarkdown:         Annotation<string | null>(),
  reportArtifactUrl:      Annotation<string | null>(),

  // ── Parallel-safe accumulation ─────────────────────────────────────────────
  // agentStatus: each parallel agent returns only its own key delta.
  // Shallow-merge at the record level preserves all other agents' statuses.
  // See updateAgentStatus() in resumeState.ts for the delta contract.
  agentStatus: Annotation<AgentStatusMap>({
    value:   (a, b) => ({ ...a, ...b } as AgentStatusMap),
    default: initialAgentStatusMap,
  }),

  // warnings: each agent returns only its new warning(s).
  // Concat accumulates across the full run, including parallel branches.
  warnings: Annotation<string[]>({
    value:   (a, b) => [...a, ...b],
    default: () => [],
  }),
});

// Export for use in Route Handlers and tests
export type GraphState = typeof GraphAnnotation.State;

// ─── Node wrapper type ─────────────────────────────────────────────────────────
// Enforces the agent contract at the graph boundary.

type NodeFn = (
  state: ResumeJobState,
  config: RunnableConfig
) => Promise<Partial<ResumeJobState>>;

// ─── Graph builder ─────────────────────────────────────────────────────────────

export function buildResumeGraph() {
  // Fluent builder: each .addNode() registers the name in TypeScript's type
  // system so .addEdge() can validate that both endpoints exist at compile time.
  // Kimi Code variants are wired here (not inside agents) per invariant #6.
  return new StateGraph(GraphAnnotation)
    // ── Nodes ─────────────────────────────────────────────────────────────
    .addNode("inputParser",       inputParserNode      as NodeFn)
    .addNode("jobAgent",          jobAgentNode         as NodeFn)
    .addNode("companyAgent",      companyAgentNode     as NodeFn)
    .addNode("resumeAnalyzer",    resumeAnalyzerNode   as NodeFn)
    .addNode("strategyAgent",     strategyAgentNode    as NodeFn)
    .addNode("resumeWriter",      resumeWriterNode     as NodeFn)
    .addNode("coverLetterWriter", coverLetterWriterNode as NodeFn)
    .addNode("finalCompiler",     finalCompilerNode    as NodeFn)

    // ── Edges — explicit topology, no implicit wiring ─────────────────────
    .addEdge(START, "inputParser")

    // Fan-out: three research agents run in parallel
    .addEdge("inputParser", "jobAgent")
    .addEdge("inputParser", "companyAgent")
    .addEdge("inputParser", "resumeAnalyzer")

    // Fan-in: strategyAgent waits for all three to complete
    .addEdge("jobAgent",       "strategyAgent")
    .addEdge("companyAgent",   "strategyAgent")
    .addEdge("resumeAnalyzer", "strategyAgent")

    // Fan-out: two writer agents run in parallel
    .addEdge("strategyAgent", "resumeWriter")
    .addEdge("strategyAgent", "coverLetterWriter")

    // Fan-in: finalCompiler waits for both writers
    .addEdge("resumeWriter",      "finalCompiler")
    .addEdge("coverLetterWriter", "finalCompiler")

    .addEdge("finalCompiler", END)
    .compile();
}

// Singleton compiled graph — built once, reused across requests
let _graph: ReturnType<typeof buildResumeGraph> | null = null;

export function getResumeGraph() {
  if (!_graph) _graph = buildResumeGraph();
  return _graph;
}
