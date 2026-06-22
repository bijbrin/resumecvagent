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
import { searchCompany } from "../scraper/companySearch";
import { COMPANY_AGENT_SYSTEM_PROMPT as SYSTEM_PROMPT } from "./prompts";

// ─── LLM extraction schema ────────────────────────────────────────────────────

const CompanyExtractSchema = z.object({
  name:         z.string().catch(""),
  mission:      z.string().catch(""),
  values:       z.array(z.string()).catch([]),
  techStack:    z.array(z.string()).catch([]),
  cultureNotes: z.string().catch(""),
  recentNews:   z.array(z.string()).catch([]),
});

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
  searchText: string,
): string {
  const parts: string[] = [`Company: ${companyName}`];
  if (searchText)    parts.push(`Web search results:\n${searchText.slice(0, 3_000)}`);
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

  // ── Web search FIRST — discovers the official site + snippets ──────────────
  // Searching up front lets us target the real domain (e.g. lifely.com.au)
  // instead of blindly guessing "<name>.com", the usual scrape failure.
  // searchCompany tries Firecrawl /search, then falls back to Serper.
  let searchText = "";
  let discoveredUrl: string | null = null;
  if (companyName) {
    const search = await searchCompany(companyName);
    if (search) {
      searchText    = search.text;
      discoveredUrl = search.websiteUrl;
    }
  }

  // Resolve the URL to scrape: user-provided > search-discovered > TLD guess.
  const companyUrl =
    state.companyUrl ||
    discoveredUrl ||
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

  // ── Scrape homepage (+ About page) ─────────────────────────────────────────
  let homepageText = "";
  let aboutPageText = "";
  let scrapeFailed = false;
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
      scrapeFailed = true;
    }
  }

  // Only surface a warning when we have NOTHING to synthesize from. A failed
  // homepage scrape is harmless when web search already returned good material.
  const haveResearch =
    searchText.length > 0 || homepageText.length > 0 || aboutPageText.length > 0;

  if (scrapeFailed && !haveResearch) {
    warnings.push(
      appendWarning(
        state,
        `[companyAgent] Could not reach a website for "${companyName || companyUrl}" and web search returned nothing — research is limited. ` +
        "Add the company's URL in the form for richer insight.",
      ),
    );
  } else if (scrapeFailed) {
    console.warn(
      `[companyAgent] Site scrape failed for ${companyUrl}; proceeding with web-search research (${searchText.length} chars).`,
    );
  }

  // The website we can stand behind: a real (user/discovered) URL, or the
  // guessed one only if it actually scraped. Never store an unverified guess.
  const resolvedWebsite =
    state.companyUrl || discoveredUrl || (homepageText ? companyUrl : null);

  // ── LLM synthesis ─────────────────────────────────────────────────────────
  const researchText = buildResearchText(companyName, homepageText, aboutPageText, searchText);

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
      name: companyName, website: resolvedWebsite,
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
    website:      resolvedWebsite,
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
