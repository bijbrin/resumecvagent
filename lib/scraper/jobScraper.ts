import "server-only";
import * as cheerio from "cheerio";
import {
  extractLinkedInFromHtml,
  parseLinkedInText,
  formatLinkedInForLLM,
} from "./linkedinScraper";

// ─── Site identification ──────────────────────────────────────────────────────

export type JobSiteType =
  | "linkedin"
  | "indeed"
  | "seek"
  | "glassdoor"
  | "lever"
  | "greenhouse"
  | "workday"
  | "generic";

const SITE_MAP: Array<[string, JobSiteType]> = [
  ["linkedin.com",       "linkedin"   ],
  ["indeed.com",         "indeed"     ],
  ["seek.com",           "seek"       ],
  ["glassdoor.com",      "glassdoor"  ],
  ["lever.co",           "lever"      ],
  ["greenhouse.io",      "greenhouse" ],
  ["myworkdayjobs.com",  "workday"    ],
  ["workday.com",        "workday"    ],
];

function identifySite(url: string): JobSiteType {
  try {
    const { hostname } = new URL(url);
    for (const [pattern, site] of SITE_MAP) {
      if (hostname.includes(pattern)) return site;
    }
  } catch { /* malformed URL */ }
  return "generic";
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ScrapedJob {
  siteType:  JobSiteType;
  rawText:   string;       // clean text ready for LLM extraction
  charCount: number;
}

export interface ScrapedPage {
  text: string;
  html: string;
}

// ─── Firecrawl ────────────────────────────────────────────────────────────────
// Called via REST — no SDK dependency. Firecrawl runs a real headless browser
// with anti-bot fingerprinting, which is the only reliable way to get LinkedIn
// job content without a logged-in session.

const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?:     string;
    metadata?: { title?: string };
  };
  error?: string;
}

async function scrapeWithFirecrawl(
  url: string,
): Promise<{ text: string; html: string } | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(FIRECRAWL_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url, formats: ["markdown", "html"] }),
      signal: AbortSignal.timeout(45_000), // Firecrawl does JS rendering — allow 45s
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn(
        `[jobScraper] Firecrawl HTTP ${res.status} for ${url}` +
        (errBody ? `: ${errBody.slice(0, 200)}` : "")
      );
      return null;
    }

    const data = (await res.json()) as FirecrawlResponse;

    if (!data.success || !data.data?.markdown) {
      console.warn(`[jobScraper] Firecrawl returned no content for ${url}: ${data.error ?? "unknown"}`);
      return null;
    }

    return {
      text: data.data.markdown,
      html: data.data.html ?? "",
    };
  } catch (err) {
    console.warn(`[jobScraper] Firecrawl fetch failed for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Direct fetch fallback ────────────────────────────────────────────────────
// Plain HTTP with a desktop Chrome User-Agent. Works for Lever, Greenhouse, and
// other ATS-hosted pages; usually returns a login wall for LinkedIn / Glassdoor.

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Cache-Control":   "no-cache",
};

function extractCleanText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, iframe, [aria-hidden='true'], [role='banner'], [role='navigation']").remove();
  $("p, div, br, li, h1, h2, h3, h4, h5, h6, section, article, td, tr").each(
    (_, el) => { $(el).prepend("\n"); }
  );
  return $("body")
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n")
    .trim();
}

async function fetchDirect(url: string): Promise<{ text: string; html: string } | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal:  AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[jobScraper] Direct fetch HTTP ${res.status} for ${url}`);
      return null;
    }
    const html = await res.text();
    const text = extractCleanText(html);
    return { text, html };
  } catch (err) {
    console.warn(`[jobScraper] Direct fetch failed for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── LinkedIn guest API ───────────────────────────────────────────────────────
// LinkedIn's /jobs/view/ URLs are bot-protected (HTTP 999). The guest API
// endpoint returns the full job HTML fragment without auth — use it instead.

function extractLinkedInJobId(url: string): string | null {
  const match = /\/jobs\/view\/(\d+)/.exec(url);
  return match?.[1] ?? null;
}

async function fetchLinkedInGuestApi(url: string): Promise<{ text: string; html: string } | null> {
  const jobId = extractLinkedInJobId(url);
  if (!jobId) return null;

  const guestUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
  try {
    const res = await fetch(guestUrl, {
      headers: {
        ...FETCH_HEADERS,
        Referer: "https://www.linkedin.com/jobs/search/",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[jobScraper] LinkedIn guest API HTTP ${res.status} for job ${jobId}`);
      return null;
    }
    const html = await res.text();
    const text = extractCleanText(html);
    console.log(`[jobScraper] LinkedIn guest API: ${text.length} chars for job ${jobId}`);
    return { text, html };
  } catch (err) {
    console.warn(`[jobScraper] LinkedIn guest API failed for job ${jobId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Minimum content threshold ────────────────────────────────────────────────
// If we get less than this after all post-processing, treat it as a login wall.

const MIN_CONTENT_CHARS = 200;

// ─── scrapeJobUrl (primary entry point) ──────────────────────────────────────
//
// Scrape strategy (in priority order):
//   1. Firecrawl — renders JS, handles anti-bot (requires FIRECRAWL_API_KEY)
//   2. LinkedIn guest API — for LinkedIn URLs, bypasses bot detection (HTTP 999)
//   3. Direct HTTP fetch — fallback for Lever, Greenhouse, and other ATS pages
//
// LinkedIn post-processing (in priority order):
//   A. CSS-selector extraction — targets div.show-more-less-html__markup + <title>
//      Works on server-rendered HTML from both Firecrawl and direct fetch.
//   B. Heuristic text parser — fallback for Firecrawl markdown or bot walls.

export async function scrapeJobUrl(url: string): Promise<ScrapedJob | null> {
  const siteType = identifySite(url);

  // ── 1. Try Firecrawl ───────────────────────────────────────────────────────
  let page = await scrapeWithFirecrawl(url);
  let source: "firecrawl" | "linkedin-guest" | "direct" | null = page ? "firecrawl" : null;

  if (!page) {
    // ── 2. LinkedIn guest API ────────────────────────────────────────────────
    // The regular /jobs/view/ URL is bot-protected. The guest API returns
    // the full job HTML fragment without auth.
    if (siteType === "linkedin") {
      page = await fetchLinkedInGuestApi(url);
      if (page) source = "linkedin-guest";
    }
  }

  if (!page) {
    // ── 3. Direct fetch fallback ─────────────────────────────────────────────
    // Works for Lever, Greenhouse, and some other ATS-hosted pages.
    // Glassdoor typically returns a login wall without Firecrawl.
    if (siteType === "glassdoor") {
      console.warn(
        "[jobScraper] Glassdoor without Firecrawl will likely return a login wall. " +
        "Set FIRECRAWL_API_KEY or paste the job description directly."
      );
    }
    page = await fetchDirect(url);
    if (page) source = "direct";
  }

  if (!page) return null;

  let rawText = page.text;
  let html    = page.html;

  // ── LinkedIn post-processing ───────────────────────────────────────────────
  // Strategy (in order):
  //   A. CSS-selector extraction from server-rendered HTML (reliable, no auth)
  //   B. Heuristic text parser (fallback for Firecrawl markdown or bot walls)
  if (siteType === "linkedin") {
    let parsed = extractLinkedInFromHtml(html, url);

    if (parsed) {
      console.log(`[jobScraper] LinkedIn: CSS-selector extraction succeeded (source: ${source}).`);
    } else {
      console.warn(
        `[jobScraper] LinkedIn: CSS selectors found no description — falling back to text heuristics. Source: ${source}.`
      );
      parsed = parseLinkedInText(rawText, html, url);
    }

    rawText = formatLinkedInForLLM(parsed);

    if (!parsed.title && !parsed.description) {
      console.warn(
        "[jobScraper] LinkedIn: both extraction strategies found no title or description. " +
        "The page may require a logged-in session. Paste the job description text directly as a workaround."
      );
    }
  }

  if (rawText.length < MIN_CONTENT_CHARS) {
    const sourceHint =
      source === "firecrawl"
        ? "Firecrawl returned minimal content — site may require a logged-in session."
        : source === "linkedin-guest"
          ? "LinkedIn guest API returned minimal content — job may be removed or URL malformed."
          : "Direct fetch returned minimal content — site may require JS rendering.";
    console.warn(
      `[jobScraper] Too little content (${rawText.length} chars) from ${siteType} at ${url}. ${sourceHint}`
    );
    return null;
  }

  return { siteType, rawText, charCount: rawText.length };
}

// ─── Generic helpers (used by companyAgent) ───────────────────────────────────

export async function scrapeUrlRaw(url: string): Promise<ScrapedPage | null> {
  // For company pages, Firecrawl is also preferred (better content quality).
  const fc = await scrapeWithFirecrawl(url);
  if (fc) return { text: fc.text, html: fc.html };

  // Fallback to direct fetch + cheerio.
  const page = await fetchDirect(url);
  if (!page) return null;
  return page.text.length > 0 ? { text: page.text, html: page.html } : null;
}

export function findAboutPageUrl(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  let origin: string;
  try { origin = new URL(baseUrl).origin; }
  catch { return null; }

  const ABOUT_TEXTS = new Set(["about", "about us", "about the company", "company", "our story"]);

  let found: string | null = null;
  $("a[href]").each((_, el) => {
    if (found) return false;
    const text = $(el).text().trim().toLowerCase();
    if (!ABOUT_TEXTS.has(text)) return;
    const href = $(el).attr("href") ?? "";
    try {
      const resolved = new URL(href, origin).href;
      if (resolved.startsWith(origin)) found = resolved;
    } catch { /* ignore */ }
  });

  return found;
}
