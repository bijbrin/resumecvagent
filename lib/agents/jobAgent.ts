import { z } from "zod";
import {
  type ResumeJobState,
  type JobDetails,
  AgentStatus,
  updateAgentStatus,
  appendWarning,
} from "../state/resumeState";
import { structuredOutputWithFallback, EXTRACTION_MODEL, type LLMProvider } from "../llm/anthropic";
import { scrapeJobUrl } from "../scraper/jobScraper";

// ─── LLM extraction schema ────────────────────────────────────────────────────
// .catch() on every field so a malformed LLM response never crashes the graph.

const JobExtractSchema = z.object({
  title:            z.string().catch(""),
  company:          z.string().catch(""),
  seniority:        z.string().catch(""),
  responsibilities: z.array(z.string()).catch([]),
  requiredSkills:   z.array(z.string()).catch([]),
  preferredSkills:  z.array(z.string()).catch([]),
  keywords:         z.array(z.string()).catch([]),
  salary:           z.string().nullable().catch(null),
  remote:           z.boolean().nullable().catch(null),
});

const SYSTEM_PROMPT = `You are an expert at parsing job descriptions.
Extract the key information from the job description provided.
If information is not present, use an empty string, empty array, or null as appropriate.`;

function buildUserPrompt(jobText: string, siteHint: string): string {
  return `Extract the job details from the following job description.
Site type (for context): ${siteHint}

--- JOB DESCRIPTION ---
${jobText.slice(0, 8_000)}
--- END ---

Return a JSON object with exactly these fields:
- title (string): the job title
- company (string): the company name
- seniority (string): level such as "Junior", "Mid", "Senior", "Staff", "Principal", "Director" — infer if not stated
- responsibilities (string[]): the main duties listed in the description
- requiredSkills (string[]): required technical and soft skills
- preferredSkills (string[]): nice-to-have or preferred skills
- keywords (string[]): ATS-critical keywords a recruiter would search for — include technologies, methodologies, certifications
- salary (string | null): salary range if mentioned, otherwise null
- remote (boolean | null): true if fully remote, false if on-site required, null if hybrid or unclear`;
}

// ─── Agent node ───────────────────────────────────────────────────────────────

export async function jobAgentNode(
  state: ResumeJobState,
): Promise<Partial<ResumeJobState>> {
  const running = updateAgentStatus(state, "jobAgent", AgentStatus.Running);

  // ── 1. Acquire job text ────────────────────────────────────────────────────
  let jobText  = state.jobDescriptionText; // user-pasted text takes priority
  let siteHint = "generic";
  const warnings: Array<Partial<ResumeJobState>> = [];

  if (!jobText) {
    const scraped = await scrapeJobUrl(state.jobUrl);
    if (scraped) {
      jobText  = scraped.rawText;
      siteHint = scraped.siteType;
      console.log(`[jobAgent] Scraped ${siteHint} — ${jobText.length} chars.`);
    } else {
      console.warn(`[jobAgent] Scraping failed for ${state.jobUrl}`);
      warnings.push(
        appendWarning(
          state,
          `[jobAgent] Could not scrape ${state.jobUrl} — site may require a login or JS rendering. ` +
          "Paste the job description into the form to bypass this.",
        ),
      );
    }
  }

  if (!jobText) {
    return {
      ...running,
      ...appendWarning(state, "[jobAgent] No job content available — scraping failed and no pasted description provided."),
      ...updateAgentStatus(state, "jobAgent", AgentStatus.Failed, "No job content"),
    };
  }

  // ── 2. LLM extraction ──────────────────────────────────────────────────────
  console.log(`[jobAgent] Starting LLM extraction (${EXTRACTION_MODEL}, ${jobText.length} chars).`);

  let extracted: z.infer<typeof JobExtractSchema>;
  let llmProvider: LLMProvider = "kimi";
  try {
    const { result, provider } = await structuredOutputWithFallback(
      [{ role: "user", content: buildUserPrompt(jobText, siteHint) }],
      JobExtractSchema,
      { model: EXTRACTION_MODEL, systemPrompt: SYSTEM_PROMPT },
    );
    extracted  = result;
    llmProvider = provider;
    console.log(`[jobAgent] LLM extraction succeeded via ${provider}. title="${extracted.title}" company="${extracted.company}"`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[jobAgent] LLM extraction failed (both providers): ${msg}`);
    return {
      ...running,
      ...appendWarning(state, `[jobAgent] LLM extraction failed: ${msg}`),
      ...updateAgentStatus(state, "jobAgent", AgentStatus.Failed, msg),
    };
  }

  // ── 3. Build JobDetails ────────────────────────────────────────────────────
  const jobDetails: JobDetails = {
    ...extracted,
    rawText: jobText.slice(0, 5_000),
  };

  // Propagate company name for the companyAgent if not already set.
  const companyUpdate =
    extracted.company && !state.companyName
      ? { companyName: extracted.company }
      : {};

  const kimiWarning =
    llmProvider !== "kimi"
      ? [appendWarning(state, `[jobAgent] Kimi unavailable — used ${llmProvider} fallback for job extraction.`)]
      : [];

  console.log(`[jobAgent] Returning jobDetails: title="${jobDetails.title}" skills=${jobDetails.requiredSkills.length}`);

  return {
    jobDetails,
    ...companyUpdate,
    ...Object.assign({}, ...[...warnings, ...kimiWarning]),
    ...updateAgentStatus(state, "jobAgent", AgentStatus.Completed),
  };
}
