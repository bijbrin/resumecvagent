import "server-only";
import * as cheerio from "cheerio";
import { NextResponse } from "next/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobListing {
  title: string;
  company: string;
  location: string;
  url: string;
  postedAt: string;
  source: "linkedin" | "seek" | "jora";
  workType?: string;
  workArrangement?: string;
  salary?: string;
  description?: string;
  bulletPoints?: string[];
  requiresClearance: boolean;
  requiresCitizenship: boolean;
}

// ── Shared fetch helper ───────────────────────────────────────────────────────

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,*/*",
  "Accept-Language": "en-AU,en;q=0.9",
  "Cache-Control": "no-cache",
};

async function fetchHtml(url: string, extraHeaders: Record<string, string> = {}): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { ...FETCH_HEADERS, ...extraHeaders },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[jobScraper] HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[jobScraper] fetch failed for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Text analysis helpers ─────────────────────────────────────────────────────

function extractWorkArrangement(text: string): string | undefined {
  const t = text.toLowerCase();
  if (
    t.includes("fully remote") ||
    t.includes("100% remote") ||
    t.includes("work from home") ||
    t.includes("wfh") ||
    t.includes("remote only")
  )
    return "Remote";
  if (t.includes("remote") && t.includes("hybrid")) return "Hybrid";
  if (t.includes("remote")) return "Remote";
  if (t.includes("hybrid")) return "Hybrid";
  if (
    t.includes("on-site") ||
    t.includes("onsite") ||
    t.includes("in office") ||
    t.includes("in-office") ||
    t.includes("office based")
  )
    return "On-site";
  return undefined;
}

function requiresClearance(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("security clearance") ||
    t.includes("nv1") ||
    t.includes("nv2") ||
    t.includes("baseline clearance") ||
    t.includes("top secret") ||
    t.includes("secret clearance") ||
    t.includes("clearance required") ||
    t.includes("security cleared") ||
    t.includes("must hold clearance") ||
    t.includes("positive vetting")
  );
}

function requiresCitizenship(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("australian citizen") ||
    t.includes("citizenship required") ||
    t.includes("must be an australian") ||
    t.includes("must hold australian") ||
    t.includes("australian permanent resident") ||
    t.includes("pr or citizen") ||
    t.includes("citizen or pr") ||
    t.includes("citizens only")
  );
}

function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

// ── Seek (JSON API v5) ────────────────────────────────────────────────────────

interface SeekJob {
  id?: string;
  title?: string;
  advertiser?: { description?: string };
  companyName?: string;
  locations?: Array<{ label?: string }>;
  workTypes?: string[];
  workArrangements?: { displayText?: string };
  salaryLabel?: string;
  teaser?: string;
  bulletPoints?: string[];
  listingDateDisplay?: string;
  listingDate?: string;
}

interface SeekApiResponse {
  data?: SeekJob[];
}

async function scrapeSeek(): Promise<JobListing[]> {
  const url =
    "https://www.seek.com.au/api/jobsearch/v5/search?" +
    "siteKey=AU-Main&where=All+Australia&keywords=software+developer+IT&" +
    "dateRange=1&sortMode=ListedDate&pageSize=30";

  try {
    const res = await fetch(url, {
      headers: {
        ...FETCH_HEADERS,
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.seek.com.au/",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as SeekApiResponse;

    return (body.data ?? []).map<JobListing>((job) => {
      const bullets = (job.bulletPoints ?? []).slice(0, 3);
      const allText = [job.title, job.teaser, ...bullets].join(" ");
      return {
        title:             job.title ?? "",
        company:           job.companyName ?? job.advertiser?.description ?? "",
        location:          job.locations?.[0]?.label ?? "",
        url:               `https://www.seek.com.au/job/${job.id ?? ""}`,
        postedAt:          job.listingDateDisplay ?? formatRelativeDate(job.listingDate ?? ""),
        source:            "seek",
        workType:          job.workTypes?.[0],
        workArrangement:   job.workArrangements?.displayText ?? extractWorkArrangement(allText),
        salary:            job.salaryLabel || undefined,
        description:       job.teaser || undefined,
        bulletPoints:      bullets,
        requiresClearance: requiresClearance(allText),
        requiresCitizenship: requiresCitizenship(allText),
      };
    });
  } catch (err) {
    console.warn("[seekScraper] API failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Jora AU (aggregates Indeed + many other AU job boards) ────────────────────

async function scrapeJora(): Promise<JobListing[]> {
  const url =
    "https://au.jora.com/s?q=software+developer+IT&l=Australia&tp=1&sort=date";
  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const jobs: JobListing[] = [];

  const WORK_TYPES = ["Full time", "Part time", "Contract", "Casual", "Internship", "Temporary"];

  $(".result.job-card").each((_, el) => {
    const title =
      $(el).find("h2.job-title a.-desktop-only").first().text().trim() ||
      $(el).find("h2.job-title a.job-link").first().text().trim();
    if (!title) return;

    const href =
      $(el).find("h2.job-title a.-desktop-only, h2.job-title a.job-link")
        .first()
        .attr("href") ?? "";

    const company  = $(el).find(".job-company").first().text().trim();
    const location = $(el).find(".job-location").first().text().trim();
    const bullets  = $(el)
      .find(".job-abstract li")
      .map((_, li) => $(li).text().trim())
      .get()
      .slice(0, 3);

    // .badge.-default-badge can hold workType OR salary — distinguish by content
    const badges = $(el)
      .find(".badge.-default-badge .content")
      .map((_, b) => $(b).text().trim())
      .get();
    const workType = badges.find((b) =>
      WORK_TYPES.some((t) => b.toLowerCase().includes(t.toLowerCase()))
    );
    const salary = badges.find((b) => b.includes("$"));

    const bottomText = $(el).find(".bottom-container").text().trim();
    const postedAtMatch = bottomText.match(/Posted\s+(.+?)(?:\s+Save|$)/i);
    const postedAt = postedAtMatch?.[1]?.trim() ?? "";

    const allText = [title, company, location, ...bullets].join(" ");

    jobs.push({
      title,
      company,
      location,
      url:  `https://au.jora.com${href.split("?")[0]}`,
      postedAt,
      source: "jora",
      workType: workType || undefined,
      salary:   salary   || undefined,
      bulletPoints: bullets,
      workArrangement:    extractWorkArrangement(allText),
      requiresClearance:  requiresClearance(allText),
      requiresCitizenship: requiresCitizenship(allText),
    });
  });

  return jobs.slice(0, 30);
}

// ── LinkedIn (jobs-guest API — returns server-rendered HTML fragments) ─────────

async function scrapeLinkedIn(): Promise<JobListing[]> {
  const url =
    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?" +
    "keywords=software+engineer+developer&location=Australia&f_TPR=r86400&start=0";
  const html = await fetchHtml(url, { Referer: "https://www.linkedin.com/jobs/search/" });
  if (!html) return [];

  const $ = cheerio.load(html);
  const jobs: JobListing[] = [];

  $(".job-search-card").each((_, el) => {
    const title   = $(el).find(".base-search-card__title").first().text().trim();
    if (!title) return;
    const company  = $(el).find(".base-search-card__subtitle").first().text().trim();
    const location = $(el).find(".job-search-card__location").first().text().trim();
    const timeEl   = $(el).find("time");
    const rawDate  = timeEl.attr("datetime") ?? timeEl.text().trim();
    const href     = $(el).find("a.base-card__full-link").first().attr("href") ?? "";

    const allText = `${title} ${company} ${location}`;

    jobs.push({
      title,
      company,
      location,
      url:     href,
      postedAt: formatRelativeDate(rawDate),
      source:  "linkedin",
      workArrangement:    extractWorkArrangement(allText),
      requiresClearance:  requiresClearance(allText),
      requiresCitizenship: requiresCitizenship(allText),
    });
  });

  return jobs.slice(0, 30);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const [seekResult, joraResult, linkedinResult] = await Promise.allSettled([
    scrapeSeek(),
    scrapeJora(),
    scrapeLinkedIn(),
  ]);

  return NextResponse.json({
    results: {
      seek:     seekResult.status     === "fulfilled" ? seekResult.value     : [],
      jora:     joraResult.status     === "fulfilled" ? joraResult.value     : [],
      linkedin: linkedinResult.status === "fulfilled" ? linkedinResult.value : [],
    },
    errors: {
      seek:     seekResult.status     === "rejected" ? String(seekResult.reason)     : null,
      jora:     joraResult.status     === "rejected" ? String(joraResult.reason)     : null,
      linkedin: linkedinResult.status === "rejected" ? String(linkedinResult.reason) : null,
    },
    scrapedAt: new Date().toISOString(),
  });
}
