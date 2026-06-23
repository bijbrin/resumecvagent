## ResumeCVAgent — Application Building Context

Read the following files in order before implementing
or making any architectural decision in the
ResumeCVAgent Next.js 16 project:

1. `context/project-overview.md` — product definition,
   goals, agent workflow, and scope of the Resume &
   Cover Letter Optimization Agent
2. `context/architecture.md` — Next.js 16 + LangGraph.js
   multi-agent system structure, module boundaries,
   state model, and invariants
3. `context/ui-context.md` — theme, colors, typography,
   and component conventions
4. `context/code-standards.md` — TypeScript / Next.js
   implementation rules, server component defaults,
   and agent node conventions
5. `context/ai-workflow-rules.md` — development workflow,
   scoping rules, and how to add or modify agents
6. `context/progress-tracker.md` — current phase,
   completed work, open questions, and next steps

Update `context/progress-tracker.md` after each
meaningful implementation change to ResumeCVAgent.

If implementation changes the LangGraph.js workflow,
agent boundaries, state schema (`ResumeJobState`), or
standards documented in the context files, update the
relevant file before continuing.


## Key surfaces & invariants

- **Design system (2026-06-22 redesign).** Dark-first
  **crimson** accent (`#FF5161`) + **Geist / Geist Mono**,
  defined as CSS custom properties in `app/globals.css`
  — components theme via `var(--…)` tokens (`--bg-base`,
  `--surface`, `--text-*`, `--accent*`, `--ok`), never
  hardcoded hex. Accent is runtime-swappable
  (crimson/violet/teal/amber) via `data-accent` on
  `<html>` (`components/app-shell/accent-switcher.tsx`).
  The authenticated app uses a **two-column sidebar
  shell** (`app/(app)/layout.tsx` +
  `components/app-shell/*`), not a top-bar. See
  `context/ui-context.md` for the full token tables.

- **Live pipeline is bound to real data, not a synthetic
  timeline.** `components/agent-pipeline.tsx`
  (Flow/Timeline/Stream) derives every visual state from
  the polled `AgentStatusMap` (status enum, real
  `startedAt`/`endedAt`/`message` timestamps) and the run
  `fitScore`/`warnings`. Keep it presentation-only — don't
  fabricate scores or reorder the 8 agents
  (IP/JB/CR/RA/ST/RW/CW/FC), whose stage grouping mirrors
  the backend graph.

- **`/applications/[id]` is the single canonical
  application detail page.** It merges what used to be
  split between the application view and the optimizer
  results view: editable Resume/Cover Letter documents
  (markdown + `.docx`/`.pdf` via `DocumentPanel`), the JD/
  Review/Report/Interview tabs, company research, warnings,
  fit score, an "Important for the role" panel, a Sync
  button, and an **AI Chat** tab. `/results/[id]`
  (localStorage optimizer history) now redirects here when
  a tracked application matches the run's jobUrl; otherwise
  it falls back to the read-only `ResultsView`. Do not
  re-fork these into two pages — extend the shared
  components (`components/company-card.tsx`,
  `components/warnings-section.tsx`, `fitScoreStyle` in
  `lib/applications/status.ts`) instead.

- **Run insights bridge.** Structured signals on the
  detail page (company research, JD breakdown, fit score,
  warnings) come from the latest DONE `OptimizationRun`
  linked to the application, via
  `lib/applications/runInsights.ts`.

- **PII invariant — application runs persist a redacted
  `resultJson`.** The folder is the system of record for
  resume/cover-letter content; it must never land in
  Postgres. Application re-runs use
  `persistResultJson: false`, and the optimize route's
  `onDone` writes back only the PII-safe insight fields
  (companyResearch, jobDetails, fitScore, warnings) — never
  optimizedResumeContent / optimizedCoverLetter. Preserve
  this split when touching `app/api/applications/[id]/
  optimize/route.ts` or `lib/graph/runOptimization.ts`.

- **AI chat persists to `Chat.md` in the job folder**
  (folder-as-source-of-truth, like JD/Resume). Read/write
  via `lib/sync/chat.ts`; the grounded reply is built in
  `app/api/applications/[id]/chat/route.ts` using
  `chatComplete()` in `lib/llm/anthropic.ts` (reasoning
  tier, full provider fallback chain).


## Commit conventions

Do NOT add `Co-Authored-By: Claude …` trailers (or any
Claude/Anthropic attribution) to commit messages or PR
descriptions in this repo. Plain commit messages only.
