import "server-only";
import * as cheerio from "cheerio";
import { NextRequest, NextResponse } from "next/server";
import { firecrawlScrapeJson } from "@/lib/scraper/firecrawl";
import {
  buildTags,
  formatRelativeDate,
  normalizeUrl,
  type JobListing,
  type JobSource,
} from "@/lib/scraper/jobTags";

// Firecrawl JSON extraction takes ~10-30s per board; they run in parallel.
export const runtime = "nodejs";
// Some boards (Indeed, Hays) take ~45-65s; the slowest bounds the parallel run.
export const maxDuration = 180;

// Each source is fetched independently (one HTTP call per source) so the client
// can render the fast LinkedIn list immediately and stream the slow Firecrawl
// boards in as they finish. Per-source caps keep the same ratio as the old
// 50-job scan, scaled to a 20-job total.
const PER_SOURCE_CAP: Record<JobSource, number> = {
  seek: 4,
  jora: 3,
  indeed: 3,
  adzuna: 2,
  other: 4,
  linkedin: 4,
};

// ── Firecrawl boards ──────────────────────────────────────────────────────────
//
// Each board's PUBLIC search-results page is scraped through Firecrawl, which
// renders JS and uses an LLM to extract the listing array against the schema
// below — resilient to markup changes that would break a cheerio selector.
// (LinkedIn is handled separately: Firecrawl does not support it.)

interface RawJob {
  title?: string;
  company?: string;
  location?: string;
  url?: string;
  salary?: string;
  postedAt?: string;
  summary?: string;
}

const JOB_SCHEMA = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          company: { type: "string" },
          location: { type: "string" },
          url: { type: "string", description: "Absolute URL to the job posting" },
          salary: { type: "string" },
          postedAt: { type: "string", description: "When it was posted, e.g. '2d ago'" },
          summary: { type: "string", description: "One or two sentence teaser of the role" },
        },
        required: ["title", "url"],
      },
    },
  },
  required: ["jobs"],
} as const;

const EXTRACT_PROMPT =
  "Extract every job posting listed on this search-results page. For each, capture the " +
  "title, hiring company, location, a direct absolute URL to the posting, salary if shown, " +
  "how long ago it was posted, and a short summary including any security clearance or " +
  "Australian citizenship requirements.";

interface BoardConfig {
  source: JobSource;
  searchUrl: string;
  /** Resolve a possibly-relative posting URL to an absolute one. */
  resolveUrl: (raw: string) => string;
}

const BOARDS: BoardConfig[] = [
  {
    source: "seek",
    searchUrl:
      "https://www.seek.com.au/software-developer-jobs/in-All-Australia?sortmode=ListedDate",
    resolveUrl: (raw) =>
      raw.startsWith("http") ? raw : `https://www.seek.com.au${raw.startsWith("/") ? "" : "/"}${raw}`,
  },
  {
    source: "jora",
    searchUrl: "https://au.jora.com/j?q=software+developer&l=Australia&sort=date",
    resolveUrl: (raw) =>
      raw.startsWith("http") ? raw : `https://au.jora.com${raw.startsWith("/") ? "" : "/"}${raw}`,
  },
  {
    // Indeed has heavy bot protection but Firecrawl handles it (slower, ~45s).
    source: "indeed",
    searchUrl: "https://au.indeed.com/jobs?q=software+developer&sort=date",
    resolveUrl: (raw) =>
      raw.startsWith("http") ? raw : `https://au.indeed.com${raw.startsWith("/") ? "" : "/"}${raw}`,
  },
  {
    source: "adzuna",
    searchUrl: "https://www.adzuna.com.au/search?q=software%20developer&sort_by=date",
    resolveUrl: (raw) =>
      raw.startsWith("http") ? raw : `https://www.adzuna.com.au${raw.startsWith("/") ? "" : "/"}${raw}`,
  },
];

// ── "Other" general platforms ────────────────────────────────────────────────
//
// A grab-bag of smaller boards, scraped the same way and merged under a single
// "other" source capped at OTHER_CAP. Only sites that Firecrawl can actually
// extract are listed — CareerOne, Workforce Australia, TechSydney, ICTCareer and
// pitchd.tech were tested and excluded (timeout / empty / dead domain).
const OTHER_SITES: BoardConfig[] = [
  {
    source: "other",
    searchUrl:
      "https://www.glassdoor.com.au/Job/australia-software-developer-jobs-SRCH_IL.0,9_IN16_KO10,28.htm",
    resolveUrl: (raw) =>
      raw.startsWith("http") ? raw : `https://www.glassdoor.com.au${raw.startsWith("/") ? "" : "/"}${raw}`,
  },
  {
    source: "other",
    searchUrl: "https://wellfound.com/role/l/software-engineer/australia",
    resolveUrl: (raw) =>
      raw.startsWith("http") ? raw : `https://wellfound.com${raw.startsWith("/") ? "" : "/"}${raw}`,
  },
  {
    source: "other",
    searchUrl: "https://www.hays.com.au/job-search/software-developer-jobs-in-australia",
    resolveUrl: (raw) =>
      raw.startsWith("http") ? raw : `https://www.hays.com.au${raw.startsWith("/") ? "" : "/"}${raw}`,
  },
];

function normalizeBoard(board: BoardConfig, raws: RawJob[]): JobListing[] {
  const jobs = raws
    .filter((j) => j.title && j.url)
    .map<JobListing>((j) => {
      const title = j.title!.trim();
      const location = (j.location ?? "").trim();
      const summary = (j.summary ?? "").trim();
      return {
        title,
        company: (j.company ?? "").trim(),
        location,
        url: board.resolveUrl(j.url!.trim()),
        postedAt: formatRelativeDate((j.postedAt ?? "").trim()),
        source: board.source,
        salary: j.salary?.trim() || undefined,
        summary: summary || undefined,
        tags: buildTags(title, `${j.company ?? ""} ${location} ${summary}`, location),
      };
    });
  return jobs;
}

async function scrapeBoard(board: BoardConfig): Promise<JobListing[]> {
  const data = await firecrawlScrapeJson<{ jobs?: RawJob[] }>(board.searchUrl, {
    prompt: EXTRACT_PROMPT,
    schema: JOB_SCHEMA,
    // Under concurrent load Firecrawl's LLM extraction can take 90s+ for large
    // boards (SEEK), so allow generous headroom below the route's maxDuration.
    timeoutMs: 150_000,
  });
  if (!data?.jobs?.length) return [];
  return normalizeBoard(board, data.jobs);
}

/** Scrape every "other" platform in parallel, merge + dedupe. */
async function scrapeOther(): Promise<JobListing[]> {
  const settled = await Promise.allSettled(OTHER_SITES.map(scrapeBoard));
  const seen = new Set<string>();
  const out: JobListing[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const job of r.value) {
      const key = normalizeUrl(job.url);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(job);
    }
  }
  return out;
}

// ── LinkedIn (guest list endpoint) ────────────────────────────────────────────
//
// Firecrawl can't scrape LinkedIn, but the public jobs-guest endpoint returns a
// server-rendered HTML fragment of job cards. We extract the LIST only (title /
// company / location / url) and flag each job `needsManualJd` — the drawer then
// asks the user to open the listing and paste the description + pick tags.

async function scrapeLinkedIn(): Promise<JobListing[]> {
  const url =
    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?" +
    "keywords=software%20developer&location=Australia&f_TPR=r86400&start=0";
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-AU,en;q=0.9",
        Referer: "https://www.linkedin.com/jobs/search/",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  const $ = cheerio.load(html);
  const jobs: JobListing[] = [];

  $(".job-search-card").each((_, el) => {
    const title = $(el).find(".base-search-card__title").first().text().trim();
    if (!title) return;
    const company = $(el).find(".base-search-card__subtitle").first().text().trim();
    const location = $(el).find(".job-search-card__location").first().text().trim();
    const timeEl = $(el).find("time");
    const rawDate = timeEl.attr("datetime") ?? timeEl.text().trim();
    const href = $(el).find("a.base-card__full-link").first().attr("href") ?? "";

    jobs.push({
      title,
      company,
      location,
      url: href.split("?")[0],
      postedAt: formatRelativeDate(rawDate),
      source: "linkedin",
      needsManualJd: true,
      // No description from the list — tag from title + location only.
      tags: buildTags(title, `${company} ${location}`, location),
    });
  });

  return jobs;
}

// ── Source registry ───────────────────────────────────────────────────────────

const RUNNERS: Record<JobSource, () => Promise<JobListing[]>> = {
  seek: () => scrapeBoard(BOARDS[0]),
  jora: () => scrapeBoard(BOARDS[1]),
  indeed: () => scrapeBoard(BOARDS[2]),
  adzuna: () => scrapeBoard(BOARDS[3]),
  other: scrapeOther,
  linkedin: scrapeLinkedIn,
};

const ALL_SOURCES = Object.keys(RUNNERS) as JobSource[];

/** Run a single source and apply its per-source cap. */
async function runSource(source: JobSource): Promise<{ jobs: JobListing[]; error: string | null }> {
  try {
    const jobs = await RUNNERS[source]();
    return {
      jobs: jobs.slice(0, PER_SOURCE_CAP[source]),
      error: jobs.length === 0 ? "No jobs returned" : null,
    };
  } catch (err) {
    return { jobs: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * `GET /api/job-scraper?source=<source>` returns just that source (the client
 * fetches each source independently so the fast LinkedIn list shows instantly
 * and the slow Firecrawl boards stream in). With no `source` it runs them all
 * in parallel (kept for compatibility / non-progressive callers).
 */
export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source") as JobSource | null;
  const scrapedAt = new Date().toISOString();

  if (source) {
    if (!RUNNERS[source]) {
      return NextResponse.json({ error: `Unknown source "${source}"` }, { status: 400 });
    }
    const { jobs, error } = await runSource(source);
    return NextResponse.json({ source, jobs, error, scrapedAt });
  }

  // No source param → run everything in parallel, deduped across sources.
  const settled = await Promise.all(ALL_SOURCES.map(runSource));
  const seen = new Set<string>();
  const jobs: JobListing[] = [];
  const bySource = {} as Record<JobSource, number>;
  const errors = {} as Record<JobSource, string | null>;

  settled.forEach((res, i) => {
    const key = ALL_SOURCES[i];
    bySource[key] = res.jobs.length;
    errors[key] = res.error;
    for (const job of res.jobs) {
      const k = normalizeUrl(job.url);
      if (seen.has(k)) continue;
      seen.add(k);
      jobs.push(job);
    }
  });

  return NextResponse.json({ jobs, bySource, errors, scrapedAt });
}
