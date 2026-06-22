import "server-only";

// Company web-search + official-site discovery.
//
// Providers, tried in order by `searchCompany`:
//   1. Firecrawl /v2/search            — primary; renders JS-heavy sites well.
//   2. Serper (google.serper.dev)      — fallback when Firecrawl is absent/empty.
// Both feed the same discovery logic and return the same shape, so the
// companyAgent doesn't care which one answered.

const SERPER_URL = "https://google.serper.dev/search";
const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";

// ─── Shared types ─────────────────────────────────────────────────────────────

interface SearchOrganic {
  title: string;
  snippet: string;
  link: string;
}

interface KnowledgeGraph {
  description?: string;
  website?: string;
  attributes?: Record<string, string>;
}

export interface CompanySearchResult {
  /** Snippets stitched into research text for the LLM. */
  text: string;
  /** Best-guess official company website discovered from the results, or null. */
  websiteUrl: string | null;
}

// ─── Official-site discovery (provider-agnostic) ──────────────────────────────

// Hosts that are never a company's own marketing site.
const AGGREGATOR_HOSTS = [
  "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
  "youtube.com", "tiktok.com", "crunchbase.com", "wikipedia.org", "glassdoor.com",
  "indeed.com", "seek.com", "seek.com.au", "bloomberg.com", "zoominfo.com",
  "apollo.io", "pitchbook.com", "medium.com", "github.com", "reddit.com",
  "trustpilot.com", "yelp.com", "owler.com", "g2.com", "capterra.com",
];

function isAggregator(host: string): boolean {
  const h = host.replace(/^www\./, "");
  return AGGREGATOR_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
}

function originOf(link: string): string | null {
  try {
    const u = new URL(link);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

// Does the host's core label look like the company? "lifely" ⊂ "lifely.com.au".
function hostMatchesCompany(host: string, slug: string): boolean {
  if (!slug) return false;
  const core = host.replace(/^www\./, "").split(".")[0];
  return core.includes(slug) || slug.includes(core);
}

function slugify(companyName: string): string {
  return companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Pick the most likely official site from everything the search surfaced.
function discoverWebsite(
  organic: ReadonlyArray<{ link: string }>,
  kg: KnowledgeGraph | undefined,
  slug: string,
): string | null {
  // 1. Knowledge-graph website is the strongest signal.
  const kgSite = kg?.website || kg?.attributes?.Website || kg?.attributes?.website;
  if (kgSite) {
    const origin = originOf(kgSite.startsWith("http") ? kgSite : `https://${kgSite}`);
    if (origin && !isAggregator(new URL(origin).hostname)) return origin;
  }

  // 2. First non-aggregator organic result whose domain looks like the company.
  for (const r of organic) {
    const origin = originOf(r.link);
    if (!origin) continue;
    if (isAggregator(new URL(origin).hostname)) continue;
    if (hostMatchesCompany(new URL(origin).hostname, slug)) return origin;
  }

  // 3. Fallback: first non-aggregator result at all (top organic is usually official).
  for (const r of organic) {
    const origin = originOf(r.link);
    if (!origin) continue;
    if (!isAggregator(new URL(origin).hostname)) return origin;
  }

  return null;
}

function companyQueries(companyName: string): string[] {
  const year = new Date().getFullYear();
  return [
    `${companyName} company mission values culture`,
    `${companyName} what they do products services`,
    `${companyName} news ${year}`,
  ];
}

// ─── Provider 1: Serper ───────────────────────────────────────────────────────

interface SerperResult {
  organic?: SearchOrganic[];
  knowledgeGraph?: KnowledgeGraph;
  answerBox?: { answer?: string; snippet?: string };
}

export async function serperCompanySearch(
  companyName: string,
): Promise<CompanySearchResult | null> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;

  const parts: string[] = [];
  const allOrganic: SearchOrganic[] = [];
  let knowledgeGraph: KnowledgeGraph | undefined;

  for (const q of companyQueries(companyName)) {
    try {
      const res = await fetch(SERPER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
        body: JSON.stringify({ q, num: 5 }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        console.warn(`[companySearch:serper] HTTP ${res.status} for query: ${q}`);
        continue;
      }

      const data = (await res.json()) as SerperResult;

      if (data.knowledgeGraph) {
        knowledgeGraph ??= data.knowledgeGraph;
        if (data.knowledgeGraph.description)
          parts.push(`Overview: ${data.knowledgeGraph.description}`);
        for (const [k, v] of Object.entries(data.knowledgeGraph.attributes ?? {})) {
          parts.push(`${k}: ${v}`);
        }
      }
      if (data.answerBox?.snippet) parts.push(`Answer: ${data.answerBox.snippet}`);

      for (const r of data.organic?.slice(0, 4) ?? []) {
        if (r.snippet) parts.push(`${r.title}: ${r.snippet}`);
        allOrganic.push(r);
      }
    } catch (err) {
      console.warn(
        `[companySearch:serper] Query failed ("${q}"):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (parts.length === 0 && allOrganic.length === 0) return null;

  const websiteUrl = discoverWebsite(allOrganic, knowledgeGraph, slugify(companyName));
  console.log(
    `[companySearch:serper] ${parts.length} snippets for "${companyName}"` +
    (websiteUrl ? ` — discovered site ${websiteUrl}` : " — no official site found"),
  );
  return { text: parts.join("\n\n"), websiteUrl };
}

// ─── Provider 2: Firecrawl /v2/search ─────────────────────────────────────────

interface FirecrawlSearchResult {
  success?: boolean;
  data?: {
    web?: Array<{ title?: string; url?: string; description?: string; markdown?: string }>;
  };
  warning?: string;
}

export async function firecrawlCompanySearch(
  companyName: string,
): Promise<CompanySearchResult | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  const parts: string[] = [];
  const organic: SearchOrganic[] = [];

  for (const q of companyQueries(companyName)) {
    try {
      const res = await fetch(FIRECRAWL_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ query: q, limit: 5, sources: [{ type: "web" }] }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.warn(
          `[companySearch:firecrawl] HTTP ${res.status} for query: ${q}` +
          (errBody ? `: ${errBody.slice(0, 200)}` : ""),
        );
        continue;
      }

      const data = (await res.json()) as FirecrawlSearchResult;

      for (const r of data.data?.web?.slice(0, 4) ?? []) {
        if (!r.url) continue;
        const snippet = r.description || (r.markdown ? r.markdown.slice(0, 300) : "");
        if (snippet) parts.push(`${r.title ?? r.url}: ${snippet}`);
        organic.push({ title: r.title ?? "", snippet, link: r.url });
      }
    } catch (err) {
      console.warn(
        `[companySearch:firecrawl] Query failed ("${q}"):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (parts.length === 0 && organic.length === 0) return null;

  const websiteUrl = discoverWebsite(organic, undefined, slugify(companyName));
  console.log(
    `[companySearch:firecrawl] ${parts.length} snippets for "${companyName}"` +
    (websiteUrl ? ` — discovered site ${websiteUrl}` : " — no official site found"),
  );
  return { text: parts.join("\n\n"), websiteUrl };
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────
// Firecrawl /search first (renders JS-heavy sites, better content quality);
// Serper as fallback when Firecrawl has no key or returns nothing usable.

export async function searchCompany(
  companyName: string,
): Promise<CompanySearchResult | null> {
  const firecrawl = await firecrawlCompanySearch(companyName);
  if (firecrawl && firecrawl.text.length > 0) return firecrawl;

  const serper = await serperCompanySearch(companyName);
  if (serper) return serper;

  // Either null, or a thin Firecrawl result (e.g. a discovered URL but no snippets).
  return firecrawl;
}
