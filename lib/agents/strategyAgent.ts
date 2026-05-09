import { z } from "zod";
import {
  type ResumeJobState,
  type TailoringStrategy,
  AgentStatus,
  updateAgentStatus,
  appendWarning,
} from "../state/resumeState";
import { structuredOutput, REASONING_MODEL } from "../llm/anthropic";

// ─── LLM extraction schema ────────────────────────────────────────────────────

const StrategySchema = z.object({
  fitScore:      z.number().int().min(0).max(100).catch(50),
  gaps:          z.array(z.object({
    title:  z.string().catch(""),
    detail: z.string().catch(""),
  })).catch([]),
  plan:          z.array(z.string()).catch([]),
  keywordsToAdd: z.array(z.string()).catch([]),
});

// ─── Pre-LLM skill gap analysis ───────────────────────────────────────────────
// Simple substring search — fast and provides grounding data for the prompt.

function computeSkillGaps(
  requiredSkills: string[],
  resumeText: string,
): { matched: string[]; missing: string[] } {
  const lower = resumeText.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of requiredSkills) {
    (lower.includes(skill.toLowerCase()) ? matched : missing).push(skill);
  }
  return { matched, missing };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert career strategist and resume optimization consultant.
Create a specific, actionable tailoring strategy that bridges a candidate's experience to a target role.

CRITICAL RULES:
- Quote actual mission statements, values, and job requirements — never use placeholders.
- Every plan step must name the concrete action (e.g. "Add 'Kubernetes' to the Skills section" not "Add missing skills").
- The plan array is read line-by-line by the resume and cover letter writers — write it as direct instructions to them.`;

function buildUserPrompt(
  state: ResumeJobState,
  matched: string[],
  missing: string[],
): string {
  const jd  = state.jobDetails!;
  const co  = state.companyResearch;
  const ra  = state.resumeAnalysis;

  const coBlock = co
    ? `Mission:      ${co.mission ?? "Not available"}
Values:       ${co.values.join(", ") || "Not available"}
Culture:      ${co.cultureNotes || "Not available"}
Tech Stack:   ${co.techStack.join(", ") || "Not available"}`
    : "Company research unavailable — use job description context only.";

  const raBlock = ra
    ? `ATS Score:    ${ra.atsScore}/100
Strengths:    ${ra.strengths.join(" | ") || "None identified"}
Weak Phrases: ${ra.weakVerbs.join(", ") || "None"}
Missing KWs:  ${ra.missingKeywords.join(", ") || "None (no JD pasted)"}`
    : "Resume analysis unavailable.";

  return `Create a tailoring strategy for this application.

=== JOB ===
Title:         ${jd.title}
Company:       ${jd.company}
Seniority:     ${jd.seniority}
Required:      ${jd.requiredSkills.join(", ")}
Preferred:     ${jd.preferredSkills.join(", ")}
Responsibilities: ${jd.responsibilities.slice(0, 5).join(" | ")}
ATS Keywords:  ${jd.keywords.join(", ")}

=== COMPANY ===
${coBlock}

=== RESUME ANALYSIS ===
${raBlock}

=== PRE-COMPUTED SKILL GAP ===
Required skills confirmed in resume (${matched.length}): ${matched.join(", ") || "none"}
Required skills MISSING from resume (${missing.length}): ${missing.join(", ") || "none"}

=== OUTPUT ===
Return a JSON object with exactly these fields:

fitScore (integer 0-100):
  Overall candidate-job fit score. Weight required skill match heavily.

gaps (array of {title, detail}):
  3–5 specific skill or experience gaps. Each "detail" must be actionable:
  e.g. "Add a bullet showing React experience in the most recent role."

plan (string[]):
  8–12 ordered instructions for the resume and cover letter writers. Be concrete:
  - Name the exact section to edit (Summary, Skills, Experience bullet)
  - Quote the actual mission/values when referencing them
  - Specify which weak phrases to replace and with what STAR-method framing
  - State the cover letter's opening angle and core alignment sentence
  - List which experiences to feature prominently

keywordsToAdd (string[]):
  10–20 ATS keywords that MUST appear in the tailored resume.
  Draw from required skills, JD keywords, company tech stack, and preferred skills.`;
}

// ─── Fallback strategy builder ────────────────────────────────────────────────
// Used when the LLM call fails — produces a minimal but correct TailoringStrategy.

function buildFallback(state: ResumeJobState, missing: string[]): TailoringStrategy {
  const jd = state.jobDetails!;
  return {
    fitScore:      50,
    gaps:          missing.slice(0, 5).map((s) => ({
      title:  `Missing skill: ${s}`,
      detail: `Add evidence of ${s} to the resume — a project, course, or work example.`,
    })),
    plan:          [
      `Add these missing required skills to the Skills section: ${missing.slice(0, 8).join(", ")}.`,
      `Rewrite weak phrases (responsible for, helped with) as STAR-method bullets with metrics.`,
      `Lead the cover letter with why you want to work at ${jd.company} specifically.`,
    ],
    keywordsToAdd: [...jd.requiredSkills, ...jd.keywords].slice(0, 15),
  };
}

// ─── Agent node ───────────────────────────────────────────────────────────────
//
// Fan-in point: this node runs AFTER jobAgent, companyAgent, and resumeAnalyzer
// have all completed. All three outputs are guaranteed to be in state by now.
// Uses REASONING_MODEL (Sonnet) — synthesis requires more capability than extraction.

export async function strategyAgentNode(
  state: ResumeJobState,
): Promise<Partial<ResumeJobState>> {
  if (!state.jobDetails) {
    return {
      ...appendWarning(state, "[strategyAgent] Cannot build strategy — no job details available."),
      ...updateAgentStatus(state, "strategyAgent", AgentStatus.Failed, "No job details"),
    };
  }

  const { matched, missing } = computeSkillGaps(
    state.jobDetails.requiredSkills,
    state.resumeText,
  );

  let extracted: z.infer<typeof StrategySchema>;
  try {
    extracted = await structuredOutput(
      [{ role: "user", content: buildUserPrompt(state, matched, missing) }],
      StrategySchema,
      { model: REASONING_MODEL, systemPrompt: SYSTEM_PROMPT, temperature: 0.3 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      tailoringStrategy: buildFallback(state, missing),
      ...appendWarning(state, `[strategyAgent] LLM synthesis failed: ${msg}. Fallback strategy used.`),
      ...updateAgentStatus(state, "strategyAgent", AgentStatus.Completed),
    };
  }

  const tailoringStrategy: TailoringStrategy = { ...extracted };

  return {
    tailoringStrategy,
    ...updateAgentStatus(state, "strategyAgent", AgentStatus.Completed),
  };
}
