import {
  type ResumeJobState,
  AgentStatus,
  updateAgentStatus,
  appendWarning,
} from "../state/resumeState";
import { generateText, REASONING_MODEL } from "../llm/anthropic";
import { RESUME_WRITER_SYSTEM_PROMPT as SYSTEM_PROMPT } from "./prompts";

// ─── Placeholder cleanup ──────────────────────────────────────────────────────
// Strip any [bracket] patterns the model may emit despite instructions.

function cleanPlaceholders(text: string): string {
  return text
    .replace(/\[.*?\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
// SYSTEM_PROMPT lives in ./prompts (RESUME_WRITER_SYSTEM_PROMPT).

function buildUserPrompt(state: ResumeJobState): string {
  const jd = state.jobDetails!;
  const co = state.companyResearch;
  const ts = state.tailoringStrategy!;

  const missionLine = co?.mission ? `"${co.mission}"` : "Not available — infer from job description context.";
  const valuesLine  = co?.values.length ? co.values.slice(0, 6).map((v) => `"${v}"`).join(", ") : "Not available.";
  const cultureLine = co?.cultureNotes || "Not specified.";
  const newsBlock   = co?.recentNews.length
    ? co.recentNews.slice(0, 3).map((n) => `- ${n}`).join("\n")
    : "None available.";

  const responsibilitiesBlock = jd.responsibilities
    .slice(0, 8)
    .map((r) => `- ${r}`)
    .join("\n");

  const planBlock = ts.plan.map((step, i) => `${i + 1}. ${step}`).join("\n");

  return `ALIGN the following resume for this specific job and company.

=== TARGET JOB ===
Title:          ${jd.title}
Company:        ${jd.company}
Seniority:      ${jd.seniority}
Required Skills: ${jd.requiredSkills.join(", ")}
Preferred Skills: ${jd.preferredSkills.join(", ")}
Key Responsibilities:
${responsibilitiesBlock}

=== COMPANY RESEARCH ===
Company Name: ${jd.company}
Mission:  ${missionLine}
Values:   ${valuesLine}
Culture:  ${cultureLine}
Recent News:
${newsBlock}

=== TAILORING STRATEGY ===
Fit Score: ${ts.fitScore}/100
ATS Keywords to weave in: ${ts.keywordsToAdd.slice(0, 20).join(", ")}
Ordered instructions:
${planBlock}

=== CANDIDATE RESUME ===
${state.resumeText.slice(0, 10000)}
=== END RESUME ===

INSTRUCTIONS:
1. Preserve the original resume structure — do not reorganise sections.
2. Rewrite the PROFESSIONAL SUMMARY to show alignment with:
   - The specific job requirements (mention the top 3 required skills).
   - The company's mission: ${missionLine}
   - Why this candidate fits THIS role at THIS company.
3. Selectively enhance 2–3 key experience bullets using STAR format:
   [Action] + [Task] + [Quantifiable Result] + [Tool]
4. Minor Skills reorganisation — prioritise job-description skills, keep all original skills.

CRITICAL RULES:
✓ Never use placeholders like [specify X] or [add metric].
✓ Never invent experiences — only enhance existing bullets.
✓ Reference the company's actual mission/values from research.
✓ Keep all original sections (Education, Certifications, etc.) unchanged.
✓ Single-column format, no tables, no first-person pronouns.

Provide the aligned resume in clean Markdown format.`;
}

// ─── Fallback content ─────────────────────────────────────────────────────────

function buildFallback(state: ResumeJobState): string {
  return `${state.resumeText}\n\n---\n*Resume alignment could not be completed — original content preserved.*`;
}

// ─── Agent node ───────────────────────────────────────────────────────────────
//
// Runs in parallel with coverLetterWriter after strategyAgent completes.
// Reads: resumeText, jobDetails, companyResearch, tailoringStrategy.
// Writes: optimizedResumeContent.

export async function resumeWriterNode(
  state: ResumeJobState,
): Promise<Partial<ResumeJobState>> {
  if (!state.tailoringStrategy || !state.jobDetails) {
    const reason = !state.jobDetails
      ? "jobDetails is null — jobAgent could not extract job content (URL may need JS rendering or JD text was not pasted)"
      : "tailoringStrategy is null — strategyAgent did not complete";
    console.warn(`[resumeWriter] Falling back to original resume. Reason: ${reason}`);
    return {
      optimizedResumeContent: buildFallback(state),
      ...appendWarning(state, `[resumeWriter] ${reason}. Original resume preserved.`),
      ...updateAgentStatus(state, "resumeWriter", AgentStatus.Completed, "Fallback: no strategy"),
    };
  }

  let aligned: string;
  try {
    aligned = await generateText(
      [{ role: "user", content: buildUserPrompt(state) }],
      { model: REASONING_MODEL, systemPrompt: SYSTEM_PROMPT, temperature: 0.3, maxTokens: 4000 },
    );
    aligned = cleanPlaceholders(aligned);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[resumeWriter] LLM call failed: ${msg}`);
    return {
      optimizedResumeContent: buildFallback(state),
      ...appendWarning(state, `[resumeWriter] LLM alignment failed: ${msg}. Original resume preserved.`),
      ...updateAgentStatus(state, "resumeWriter", AgentStatus.Completed, "Fallback: LLM error"),
    };
  }

  return {
    optimizedResumeContent: aligned,
    ...updateAgentStatus(state, "resumeWriter", AgentStatus.Completed),
  };
}
