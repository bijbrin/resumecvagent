import { z } from "zod";
import {
  type ResumeJobState,
  type ResumeAnalysis,
  AgentStatus,
  updateAgentStatus,
  appendWarning,
} from "../state/resumeState";
import { structuredOutput, EXTRACTION_MODEL } from "../llm/anthropic";

// ─── Weak-verb dictionary ─────────────────────────────────────────────────────
// Pre-scan catches obvious cases before the LLM sees the resume, so the LLM
// prompt can confirm and extend the list rather than discover it from scratch.

const WEAK_VERB_PATTERNS = [
  "responsible for",
  "duties included",
  "helped with",
  "assisted with",
  "participated in",
  "involved in",
  "worked on",
  "worked with",
  "was part of",
  "contributed to",
];

function preDetectWeakVerbs(resumeText: string): string[] {
  const lower = resumeText.toLowerCase();
  return WEAK_VERB_PATTERNS.filter((p) => lower.includes(p));
}

// ─── LLM extraction schema ────────────────────────────────────────────────────

const ResumeAnalysisSchema = z.object({
  atsScore:        z.number().int().min(0).max(100).catch(50),
  keywordOverlap:  z.array(z.string()).catch([]),
  missingKeywords: z.array(z.string()).catch([]),
  weakVerbs:       z.array(z.string()).catch([]),
  strengths:       z.array(z.string()).catch([]),
  gaps:            z.array(z.string()).catch([]),
});

const SYSTEM_PROMPT = `You are an expert resume reviewer and ATS optimization specialist.
Analyze the resume provided — be specific and actionable. Focus on what a recruiter and an
ATS would flag, not generic advice.`;

function buildUserPrompt(resumeText: string, jobDescriptionText: string): string {
  const hasJD = jobDescriptionText.trim().length > 0;

  const jdSection = hasJD
    ? `\n--- JOB DESCRIPTION ---\n${jobDescriptionText.slice(0, 4_000)}\n--- END JD ---\n`
    : "";

  const keywordInstructions = hasJD
    ? `- keywordOverlap: keywords/skills from the JD that already appear in the resume
- missingKeywords: important JD keywords/skills missing from the resume`
    : `- keywordOverlap: return [] (no job description provided)
- missingKeywords: return [] (no job description provided)`;

  const gapsInstruction = hasJD
    ? "- gaps: 3–5 experience or skill gaps compared to the JD requirements"
    : "- gaps: 3–5 general weaknesses or missing elements a recruiter would notice";

  return `Analyze the following resume${hasJD ? " against the job description" : " for ATS compatibility and quality"}.

--- RESUME ---
${resumeText.slice(0, 7_000)}
--- END RESUME ---
${jdSection}
Pre-detected weak phrases (confirm and extend): ${JSON.stringify(preDetectWeakVerbs(resumeText))}

Return a JSON object with exactly these fields:
- atsScore (integer 0–100): how well the resume would perform in ATS screening
${keywordInstructions}
- weakVerbs (string[]): passive phrases or weak verbs that should be replaced with strong action verbs (e.g. "responsible for", "helped with")
- strengths (string[]): 3–5 specific strong points in this resume worth preserving
${gapsInstruction}`;
}

// ─── Agent node ───────────────────────────────────────────────────────────────
//
// NOTE: Runs in parallel with jobAgent and companyAgent.
// Only reads: state.resumeText, state.jobDescriptionText (both set by inputParser).
// Does NOT read state.jobDetails — jobAgent is still running.

export async function resumeAnalyzerNode(
  state: ResumeJobState,
): Promise<Partial<ResumeJobState>> {
  if (!state.resumeText) {
    return {
      ...appendWarning(state, "[resumeAnalyzer] No resume text provided."),
      ...updateAgentStatus(state, "resumeAnalyzer", AgentStatus.Failed, "No resume text"),
    };
  }

  let extracted: z.infer<typeof ResumeAnalysisSchema>;
  try {
    extracted = await structuredOutput(
      [{ role: "user", content: buildUserPrompt(state.resumeText, state.jobDescriptionText) }],
      ResumeAnalysisSchema,
      { model: EXTRACTION_MODEL, systemPrompt: SYSTEM_PROMPT },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Fallback: use pre-detected weak verbs so the run isn't completely blind.
    const fallback: ResumeAnalysis = {
      atsScore:        50,
      keywordOverlap:  [],
      missingKeywords: [],
      weakVerbs:       preDetectWeakVerbs(state.resumeText),
      strengths:       [],
      gaps:            [],
    };
    return {
      resumeAnalysis: fallback,
      ...appendWarning(state, `[resumeAnalyzer] LLM analysis failed: ${msg}`),
      ...updateAgentStatus(state, "resumeAnalyzer", AgentStatus.Completed),
    };
  }

  const resumeAnalysis: ResumeAnalysis = { ...extracted };

  return {
    resumeAnalysis,
    ...updateAgentStatus(state, "resumeAnalyzer", AgentStatus.Completed),
  };
}
