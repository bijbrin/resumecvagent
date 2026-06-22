import {
  type ResumeJobState,
  AgentStatus,
  updateAgentStatus,
  appendWarning,
} from "../state/resumeState";
import { generateText, REASONING_MODEL } from "../llm/anthropic";
import { buildCoverLetterSystemPrompt as buildSystemPrompt } from "./prompts";

// ─── Placeholder cleanup ──────────────────────────────────────────────────────
// Replace common bracket patterns with actual values, then strip any leftovers.

function cleanPlaceholders(text: string, companyName: string, jobTitle: string): string {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const replacements: [RegExp, string][] = [
    [/\[Company(?:\s*Name)?s?\]/gi, companyName],
    [/\[Job Title\]/gi, jobTitle],
    [/\[Position\]/gi, jobTitle],
    [/\[Role\]/gi, jobTitle],
    [/\[(?:Today'?s?\s*)?Date\]/gi, today],
    [/\[Hiring Manager['s]*\s*(?:Name)?\]/gi, "Hiring Manager"],
    [/\[Manager Name\]/gi, "Hiring Manager"],
    [/\[Recruiter Name\]/gi, "Hiring Manager"],
    [/\[(?:Company\s*)?Address[^\]]*\]\n?/gi, ""],
    [/\[City[^\]]*\]\n?/gi, ""],
    [/\[.*?\]/g, ""],
    [/\byour company\b/gi, companyName],
    [/\bthe company\b(?!\s+name)/gi, companyName],
    [/\n{3,}/g, "\n\n"],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  return text.trim();
}

// ─── User prompt builder ──────────────────────────────────────────────────────
// buildSystemPrompt lives in ./prompts (buildCoverLetterSystemPrompt).

function buildUserPrompt(state: ResumeJobState): string {
  const jd = state.jobDetails!;
  const co = state.companyResearch;
  const ts = state.tailoringStrategy!;

  const companyName  = jd.company || co?.name || "the company";
  const missionLine  = co?.mission ? `"${co.mission}"` : `[Synthesise from: ${companyName} is hiring for ${jd.title} requiring ${jd.requiredSkills.slice(0, 3).join(", ")} skills]`;
  const valuesLine   = co?.values.length ? co.values.slice(0, 5).map((v) => `"${v}"`).join(", ") : "Not specified.";
  const cultureBlock = co?.cultureNotes || "Not specified.";
  const newsBlock    = co?.recentNews.length
    ? co.recentNews.slice(0, 2).map((n) => `- ${n}`).join("\n")
    : "None available.";

  const responsibilitiesBlock = jd.responsibilities
    .slice(0, 6)
    .map((r) => `- ${r}`)
    .join("\n");

  const existingCLSection = state.coverLetterText
    ? `\n--- EXISTING COVER LETTER (voice reference only — write a new letter) ---\n${state.coverLetterText.slice(0, 2000)}\n--- END EXISTING COVER LETTER ---\n`
    : "";

  const coverLetterAngle = ts.plan.find((s) => s.toLowerCase().includes("cover letter")) ?? "";
  const keywordsLine = ts.keywordsToAdd.slice(0, 5).join(", ");

  return `Write a compelling cover letter for the following application.

=== JOB DETAILS ===
Title:    ${jd.title}
Company:  ${companyName}
Required Skills: ${jd.requiredSkills.join(", ")}
Preferred Skills: ${jd.preferredSkills.join(", ")}
Key Responsibilities:
${responsibilitiesBlock}

=== COMPANY RESEARCH ===
Company Name: ${companyName}
Mission: ${missionLine}
Values:  ${valuesLine}
Culture: ${cultureBlock}
Recent News:
${newsBlock}

=== ALIGNMENT STRATEGY ===
Cover Letter Angle: ${coverLetterAngle || "Lead with the candidate's strongest relevant achievement."}
Key ATS Keywords: ${keywordsLine}

=== CANDIDATE RESUME ===
${state.resumeText.slice(0, 5000)}
=== END RESUME ===
${existingCLSection}
--- YOUR TASK ---

Write a compelling cover letter using this structure:

1. OPENING PARAGRAPH (Hook):
   - State you're applying for ${jd.title} at ${companyName}.
   - Express genuine excitement about the company's mission: ${missionLine}
   - Connect your background to ${jd.requiredSkills.slice(0, 3).join(", ")}.
   - If mission shows as [Synthesise ...], write a compelling opener based on what ${companyName} does.

2. BODY PARAGRAPH 1 (Experience):
   - Select 2–3 achievements demonstrating ${jd.requiredSkills.slice(0, 3).join(", ")}.
   - Use STAR method with quantifiable results.

3. BODY PARAGRAPH 2 (Company fit):
   - Reference values: ${valuesLine}
   - Explain why ${companyName} specifically.

4. CLOSING: Enthusiastic call to action.

CRITICAL RULES:
✓ Never use [bracket placeholders] — use actual names.
✓ Use "${companyName}" and "${jd.title}" throughout.
✓ 250–400 words, 3–4 paragraphs.
✓ Provide ONLY the cover letter text.`;
}

// ─── Fallback content ─────────────────────────────────────────────────────────

function buildFallback(state: ResumeJobState): string {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const company = state.jobDetails?.company || state.companyName || "the company";
  const title   = state.jobDetails?.title || "the role";
  return `${today}\n\nDear Hiring Manager,\n\nI am writing to express my interest in the ${title} position at ${company}. Please find my resume attached for your consideration.\n\nThank you for your time.\n\nSincerely,\n[Your Name]\n\n*Cover letter generation could not be completed — please edit this template.*`;
}

// ─── Agent node ───────────────────────────────────────────────────────────────
//
// Runs in parallel with resumeWriter after strategyAgent completes.
// Reads: resumeText, coverLetterText, jobDetails, companyResearch, tailoringStrategy.
// Writes: optimizedCoverLetter.

export async function coverLetterWriterNode(
  state: ResumeJobState,
): Promise<Partial<ResumeJobState>> {
  if (!state.tailoringStrategy || !state.jobDetails) {
    const reason = !state.jobDetails
      ? "jobDetails is null — jobAgent could not extract job content (URL may need JS rendering or JD text was not pasted)"
      : "tailoringStrategy is null — strategyAgent did not complete";
    console.warn(`[coverLetterWriter] Falling back to template. Reason: ${reason}`);
    return {
      optimizedCoverLetter: buildFallback(state),
      ...appendWarning(state, `[coverLetterWriter] ${reason}. Template cover letter returned.`),
      ...updateAgentStatus(state, "coverLetterWriter", AgentStatus.Completed, "Fallback: no strategy"),
    };
  }

  const companyName = state.jobDetails.company || state.companyResearch?.name || "the company";
  const jobTitle    = state.jobDetails.title;

  let coverLetter: string;
  try {
    coverLetter = await generateText(
      [{ role: "user", content: buildUserPrompt(state) }],
      {
        model:        REASONING_MODEL,
        systemPrompt: buildSystemPrompt(companyName, jobTitle),
        temperature:  0.4,
        maxTokens:    2500,
      },
    );
    coverLetter = cleanPlaceholders(coverLetter, companyName, jobTitle);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[coverLetterWriter] LLM call failed: ${msg}`);
    return {
      optimizedCoverLetter: buildFallback(state),
      ...appendWarning(state, `[coverLetterWriter] LLM generation failed: ${msg}. Template returned.`),
      ...updateAgentStatus(state, "coverLetterWriter", AgentStatus.Completed, "Fallback: LLM error"),
    };
  }

  return {
    optimizedCoverLetter: coverLetter,
    ...updateAgentStatus(state, "coverLetterWriter", AgentStatus.Completed),
  };
}
