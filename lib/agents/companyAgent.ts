import { z } from "zod";
import {
  type ResumeJobState,
  type CompanyResearch,
  AgentStatus,
  updateAgentStatus,
  appendWarning,
} from "../state/resumeState";
import { structuredOutput, EXTRACTION_MODEL } from "../llm/anthropic";
import { scrapeUrlRaw, findAboutPageUrl } from "../scraper/jobScraper";
import { serperCompanySearch } from "../scraper/serperSearch";

// ─── LLM extraction schema ────────────────────────────────────────────────────

const CompanyExtractSchema = z.object({
  name:         z.string().catch(""),
  mission:      z.string().catch(""),
  values:       z.array(z.string()).catch([]),
  techStack:    z.array(z.string()).catch([]),
  cultureNotes: z.string().catch(""),
  recentNews:   z.array(z.string()).catch([]),
});

const SYSTEM_PROMPT = `You are a company research analyst preparing intel for a job application.
Extract and synthesize company information from the research text provided.

IMPORTANT:
- mission: if not stated explicitly, synthesize one from the company's products, positioning, and tone. Never leave it blank.
- values: if not listed, infer 3–5 values from the job description language and company activities.
- cultureNotes: write 2–3 sentences a cover letter writer can quote directly about what it's like to work there.
- recentNews: bullet-point summaries only — omit if no news was found in the research.`;

function buildUserPrompt(companyName: string, researchText: string): string {
  return `Research the following company for a job application: "${companyName}"

--- RESEARCH DATA ---
${researchText.slice(0, 8_000)}
--- END ---

Return a JSON object with exactly these fields:
- name (string): the company's official name
- mission (string): mission or purpose statement — synthesise one if not stated
- values (string[]): core values — infer from tone and activities if not listed
- techStack (string[]): technologies, frameworks, or platforms mentioned
- cultureNotes (string): 2–3 sentences a cover letter writer can use to show company alignment
- recentNews (string[]): brief one-sentence summaries of recent news or announcements (empty array if none found)`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Heuristic: if the user didn't provide a URL we try company.com as a best
// guess. The scrape will return null if the domain doesn't match.
function guessCompanyUrl(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://www.${slug}.com`;
}

function buildResearchText(
  companyName: string,
  homepageText: string,
  aboutPageText: string,
  serperText: string,
): string {
  const parts: string[] = [`Company: ${companyName}`];
  if (serperText)    parts.push(`Web search results:\n${serperText.slice(0, 3_000)}`);
  if (homepageText)  parts.push(`Homepage:\n${homepageText.slice(0, 2_500)}`);
  if (aboutPageText) parts.push(`About page:\n${aboutPageText.slice(0, 2_500)}`);
  return parts.join("\n\n---\n\n");
}

// ─── Agent node ───────────────────────────────────────────────────────────────
//
// NOTE: This agent runs in parallel with jobAgent and resumeAnalyzer.
// It therefore sees only the state snapshot produced by inputParser — it
// CANNOT read state.jobDetails (set by jobAgent, which is still running).
// Rely solely on state.companyName and state.companyUrl (user-provided inputs).

export async function companyAgentNode(
  state: ResumeJobState,
): Promise<Partial<ResumeJobState>> {
  const companyName = state.companyName;
  const companyUrl  =
    state.companyUrl ||
    (companyName ? guessCompanyUrl(companyName) : "");

  // ── Early exit: nothing to work with ──────────────────────────────────────
  if (!companyName && !companyUrl) {
    const empty: CompanyResearch = {
      name: "", website: null, mission: null,
      values: [], recentNews: [], techStack: [], cultureNotes: "",
    };
    return {
      companyResearch: empty,
      ...appendWarning(state, "[companyAgent] No company name or URL — research skipped."),
      ...updateAgentStatus(state, "companyAgent", AgentStatus.Completed),
    };
  }

  // ── Serper web search (runs even without a URL) ────────────────────────────
  let serperText = "";
  if (companyName) {
    const snippets = await serperCompanySearch(companyName);
    if (snippets) serperText = snippets;
  }

  // ── Scrape homepage ────────────────────────────────────────────────────────
  let homepageText = "";
  let aboutPageText = "";
  const warnings: Array<Partial<ResumeJobState>> = [];

  if (companyUrl) {
    const raw = await scrapeUrlRaw(companyUrl);
    if (raw) {
      homepageText = raw.text;

      // Follow the About page link if we can find one on the homepage.
      const aboutUrl = findAboutPageUrl(raw.html, companyUrl);
      if (aboutUrl && aboutUrl !== companyUrl) {
        const aboutRaw = await scrapeUrlRaw(aboutUrl);
        if (aboutRaw) aboutPageText = aboutRaw.text;
      }
    } else {
      warnings.push(
        appendWarning(
          state,
          `[companyAgent] Could not scrape ${companyUrl} — site may block bots or require JS.`,
        ),
      );
    }
  }

  // ── LLM synthesis ─────────────────────────────────────────────────────────
  const researchText = buildResearchText(companyName, homepageText, aboutPageText, serperText);

  let extracted: z.infer<typeof CompanyExtractSchema>;
  try {
    extracted = await structuredOutput(
      [{ role: "user", content: buildUserPrompt(companyName, researchText) }],
      CompanyExtractSchema,
      { model: EXTRACTION_MODEL, systemPrompt: SYSTEM_PROMPT },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const fallback: CompanyResearch = {
      name: companyName, website: companyUrl || null,
      mission: null, values: [], recentNews: [], techStack: [], cultureNotes: "",
    };
    return {
      companyResearch: fallback,
      ...Object.assign({}, ...warnings),
      ...appendWarning(state, `[companyAgent] LLM extraction failed: ${msg}`),
      ...updateAgentStatus(state, "companyAgent", AgentStatus.Completed),
    };
  }

  const companyResearch: CompanyResearch = {
    name:         extracted.name  || companyName,
    website:      companyUrl      || null,
    mission:      extracted.mission || null,
    values:       extracted.values,
    recentNews:   extracted.recentNews,
    techStack:    extracted.techStack,
    cultureNotes: extracted.cultureNotes,
  };

  return {
    companyResearch,
    ...Object.assign({}, ...warnings),
    ...updateAgentStatus(state, "companyAgent", AgentStatus.Completed),
  };
}
