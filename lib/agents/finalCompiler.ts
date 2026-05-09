import {
  type ResumeJobState,
  AgentStatus,
  updateAgentStatus,
  appendWarning,
} from "../state/resumeState";
import { generateTextWithFallback, REASONING_MODEL } from "../llm/anthropic";

// ─── Interview cheat sheet ────────────────────────────────────────────────────

const INTERVIEW_SYSTEM_PROMPT = `You are an expert interview coach.
Create a concise, scannable interview prep cheat sheet in Markdown.
Be specific — every point must name the actual role, company, or skill.
No generic filler ("bring your best self", "be enthusiastic").`;

function buildInterviewPrompt(state: ResumeJobState): string {
  const jd = state.jobDetails!;
  const co = state.companyResearch;
  const ts = state.tailoringStrategy!;

  const valuesLine  = co?.values.slice(0, 5).join(", ") || "not listed";
  const missionLine = co?.mission || "not available";
  const newsBlock   = co?.recentNews.slice(0, 3).map((n) => `- ${n}`).join("\n") || "- None available";

  return `Create an interview cheat sheet for:

=== ROLE ===
Title:    ${jd.title}
Company:  ${jd.company}
Required Skills: ${jd.requiredSkills.join(", ")}
Key Responsibilities: ${jd.responsibilities.slice(0, 6).join(" | ")}

=== COMPANY ===
Mission: ${missionLine}
Values:  ${valuesLine}
Recent News:
${newsBlock}

=== CANDIDATE FIT ===
Fit Score: ${ts.fitScore}/100
Key Gaps: ${ts.gaps.map((g) => g.title).join(", ") || "none"}
ATS Keywords: ${ts.keywordsToAdd.slice(0, 12).join(", ")}

Produce a cheat sheet with EXACTLY these sections in this order:

## Key Company Talking Points
5 specific facts to weave into answers (mission, values, recent news).

## Likely Interview Questions
5 role-specific questions based on the responsibilities and required skills above.
Include one behavioural, one technical, one culture-fit, one situational, one "tell me about yourself" variant.

## Questions to Ask the Interviewer
3 thoughtful questions that show business acumen.

## Culture Fit Signals to Demonstrate
3–4 concrete behaviours or phrases that resonate with ${jd.company}'s stated values.

## Top 3 Skills to Emphasise
For each: skill name, one achievement from the resume, and the STAR framing.

Format as a scannable Markdown quick-reference. No bullet padding — every line earns its place.`;
}

// ─── Fallback interview prep (no LLM) ────────────────────────────────────────

function buildInterviewFallback(state: ResumeJobState): string {
  const jd = state.jobDetails;
  const co = state.companyResearch;
  const company = jd?.company || co?.name || "the company";
  const title   = jd?.title || "this role";
  const skills  = jd?.requiredSkills.slice(0, 5) || [];

  return `# Interview Cheat Sheet — ${title} at ${company}

## Key Company Talking Points
- Mission: ${co?.mission || "Research before the interview"}
- Values: ${co?.values.join(", ") || "Review their website"}

## Likely Interview Questions
1. Walk me through your experience with ${skills[0] || "the core required skills"}.
2. Why do you want to work at ${company}?
3. Describe a challenging technical problem you solved end-to-end.
4. How do you prioritise when deadlines conflict?
5. Tell me about a time you had to influence without authority.

## Questions to Ask the Interviewer
1. What does success look like in this role after 90 days?
2. What is the biggest challenge the team is currently solving?
3. How does the team approach code review / technical decisions?

## Top Skills to Emphasise
${skills.map((s) => `- **${s}**: Prepare a STAR example from your experience.`).join("\n")}
`;
}

// ─── Report compiler (template — no LLM needed) ──────────────────────────────

// Detect whether the writer actually ran (vs fell back to the static template / original text).
// We key on the fallback sentinel strings embedded in buildFallback().
function resumeWasAligned(content: string | null): boolean {
  if (!content) return false;
  return !content.includes("*Resume alignment could not be completed");
}
function coverLetterWasGenerated(content: string | null): boolean {
  if (!content) return false;
  return !content.includes("*Cover letter generation could not be completed");
}

// Extract the writer-specific warnings for a given agent prefix.
function agentWarnings(warnings: string[], prefix: string): string[] {
  return warnings.filter((w) => w.startsWith(prefix));
}

function compileReport(state: ResumeJobState, interviewCheatsheet: string): string {
  const jd = state.jobDetails;
  const co = state.companyResearch;
  const ra = state.resumeAnalysis;
  const ts = state.tailoringStrategy;
  const company = jd?.company || co?.name || state.companyName || "Unknown";
  const title   = jd?.title || "Unknown";
  const now     = new Date().toISOString().slice(0, 10);

  // ── Writer outcome detection ───────────────────────────────────────────────
  const resumeAligned = resumeWasAligned(state.optimizedResumeContent);
  const clGenerated   = coverLetterWasGenerated(state.optimizedCoverLetter);

  const resumeStatusIcon = resumeAligned ? "✅" : "⚠️";
  const clStatusIcon     = clGenerated   ? "✅" : "⚠️";

  const resumeFailReason = agentWarnings(state.warnings, "[resumeWriter]")[0]?.replace("[resumeWriter] ", "") ?? "";
  const clFailReason     = agentWarnings(state.warnings, "[coverLetterWriter]")[0]?.replace("[coverLetterWriter] ", "") ?? "";

  // Plan steps: split into resume-facing and cover-letter-facing heuristically.
  // Steps mentioning "cover letter" go to the CL block; all others to the resume block.
  const planSteps    = ts?.plan ?? [];
  const resumeSteps  = planSteps.filter((s) => !s.toLowerCase().includes("cover letter"));
  const clSteps      = planSteps.filter((s) =>  s.toLowerCase().includes("cover letter"));

  const resumeStepsBullets = resumeSteps.length
    ? resumeSteps.map((s) => `- ${s}`).join("\n")
    : "- No specific resume instructions were generated.";

  const clStepsBullets = clSteps.length
    ? clSteps.map((s) => `- ${s}`).join("\n")
    : "- Write a 3–4 paragraph letter opening with the company mission, then STAR achievements, then value alignment, then a call to action.";

  const gapsAddressed = (ts?.gaps ?? [])
    .map((g) => `- **${g.title}**: ${g.detail}`)
    .join("\n");

  const keywordsInjectedLine = ts?.keywordsToAdd.slice(0, 20).join(", ") || "None";

  // ── ATS keyword presence check in the optimized resume ────────────────────
  const optimizedText = (state.optimizedResumeContent ?? "").toLowerCase();
  const keywordResults = (ts?.keywordsToAdd ?? []).slice(0, 15).map((kw) => ({
    kw,
    found: optimizedText.includes(kw.toLowerCase()),
  }));
  const foundCount   = keywordResults.filter((k) => k.found).length;
  const missingCount = keywordResults.length - foundCount;

  const kwTable = keywordResults
    .map((k) => `| ${k.found ? "✅" : "❌"} | \`${k.kw}\` |`)
    .join("\n");

  const gapsBlock = (ts?.gaps ?? [])
    .map((g) => `- **${g.title}**: ${g.detail}`)
    .join("\n");

  const planBlock = (ts?.plan ?? [])
    .map((step, i) => `${i + 1}. ${step}`)
    .join("\n");

  const requiredSkillsBlock = (jd?.requiredSkills ?? [])
    .map((s) => `- ${s}`)
    .join("\n");

  const preferredSkillsBlock = (jd?.preferredSkills ?? [])
    .map((s) => `- ${s}`)
    .join("\n");

  const companyValuesBlock = (co?.values ?? [])
    .map((v) => `- ${v}`)
    .join("\n");

  const newsBlock = (co?.recentNews ?? []).slice(0, 3)
    .map((n) => `- ${n}`)
    .join("\n");

  return `# Resume Optimization Report

**Generated**: ${now}
**Job**: ${title} at ${company}
**Correlation ID**: \`${state.correlationId}\`

---

## Executive Summary

- **Fit Score**: ${ts?.fitScore ?? "N/A"} / 100
- **ATS Score (baseline)**: ${ra?.atsScore ?? "N/A"} / 100
- **Keywords injected**: ${foundCount} / ${keywordResults.length} verified in optimized resume${missingCount > 0 ? ` (${missingCount} not confirmed — may appear as synonyms)` : ""}

---

## What Was Updated & Why

### Resume ${resumeStatusIcon}
${resumeAligned
  ? `**Changes applied to the resume:**
${resumeStepsBullets}

**Skill gaps addressed:**
${gapsAddressed || "- No gaps were identified."}

**ATS keywords woven in:**
${keywordsInjectedLine}`
  : `**Not aligned — original resume preserved.**
> Reason: ${resumeFailReason || "Strategy or job details were unavailable."}
> To fix: paste the full job description into the form so the job agent can extract requirements without scraping.`}

### Cover Letter ${clStatusIcon}
${clGenerated
  ? `**Changes applied to the cover letter:**
${clStepsBullets}`
  : `**Not generated — template placeholder returned.**
> Reason: ${clFailReason || "Strategy or job details were unavailable."}
> To fix: paste the full job description into the form.`}

---

## ATS Quality Gates

| Status | Keyword |
|--------|---------|
${kwTable || "| — | No keywords tracked |"}

---

## Tailoring Strategy

### Fit Score: ${ts?.fitScore ?? "N/A"} / 100

### Skill Gaps
${gapsBlock || "_No gaps identified._"}

### Writer Instructions (executed)
${planBlock || "_No plan available._"}

### ATS Keywords Added
${ts?.keywordsToAdd.slice(0, 20).join(", ") || "_None._"}

---

## Optimized Resume

${state.optimizedResumeContent || "_Resume not generated._"}

---

## Cover Letter

${state.optimizedCoverLetter || "_Cover letter not generated._"}

---

## Interview Preparation

${interviewCheatsheet}

---

## Job Details Reference

| Field | Value |
|-------|-------|
| Title | ${title} |
| Seniority | ${jd?.seniority || "Not specified"} |
| Remote | ${jd?.remote === true ? "Yes" : jd?.remote === false ? "No" : "Not specified"} |
| Salary | ${jd?.salary || "Not disclosed"} |

### Required Skills
${requiredSkillsBlock || "_Not extracted._"}

### Preferred Skills
${preferredSkillsBlock || "_Not extracted._"}

---

## Company Research

| Field | Value |
|-------|-------|
| Company | ${co?.name || company} |
| Website | ${co?.website || "Not available"} |
| Mission | ${co?.mission || "Not available"} |

### Core Values
${companyValuesBlock || "_Not available._"}

### Culture Notes
${co?.cultureNotes || "_Not available._"}

### Recent News
${newsBlock || "_None available._"}

---

## Warnings

${state.warnings.length > 0
    ? state.warnings.map((w) => `- ${w}`).join("\n")
    : "_None._"}

---

*Generated by ResumeCVAgent — AlignFirst ATS Edition*
`;
}

// ─── Agent node ───────────────────────────────────────────────────────────────
//
// Fan-in: runs after resumeWriter and coverLetterWriter complete.
// Uses generateTextWithFallback for the interview cheat sheet:
//   1. Anthropic Sonnet (REASONING_MODEL)
//   2. Falls back to Kimi (Moonshot) if Sonnet throws and KIMI_API_KEY is set.
// Report assembly is template-based — no LLM needed there.

export async function finalCompilerNode(
  state: ResumeJobState,
): Promise<Partial<ResumeJobState>> {
  // ── Interview cheat sheet ──────────────────────────────────────────────────
  let interviewCheatsheet: string;
  const warnings: string[] = [];

  if (!state.jobDetails || !state.tailoringStrategy) {
    interviewCheatsheet = buildInterviewFallback(state);
    warnings.push("[finalCompiler] Missing job details or strategy — basic interview prep generated.");
  } else {
    try {
      const { text, provider } = await generateTextWithFallback(
        [{ role: "user", content: buildInterviewPrompt(state) }],
        { model: REASONING_MODEL, systemPrompt: INTERVIEW_SYSTEM_PROMPT, temperature: 0.3, maxTokens: 1800 },
      );
      interviewCheatsheet = text;
      if (provider !== "kimi") {
        warnings.push(`[finalCompiler] Kimi unavailable — interview prep generated via ${provider} fallback.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      interviewCheatsheet = buildInterviewFallback(state);
      warnings.push(`[finalCompiler] All LLM providers failed for interview prep: ${msg}. Basic template used.`);
    }
  }

  // ── Report assembly (template-based) ──────────────────────────────────────
  const reportMarkdown = compileReport(state, interviewCheatsheet);

  // warnings is a concat reducer in LangGraph — returning the array appends all items.
  return {
    interviewCheatsheet,
    reportMarkdown,
    reportArtifactUrl: null, // set when blob storage is wired
    ...(warnings.length > 0 ? { warnings } : {}),
    ...updateAgentStatus(state, "finalCompiler", AgentStatus.Completed),
  };
}
