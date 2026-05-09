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

Reference: the Python implementation that this Next.js
build replicates lives at `../ResumeCVAgentt/`. Use it
as a behavioral reference for agent prompts, scraping
heuristics, and output shapes — not as a code template.
