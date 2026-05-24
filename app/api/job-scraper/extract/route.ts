import "server-only";
import * as cheerio from "cheerio";
import { NextResponse } from "next/server";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,*/*",
  "Accept-Language": "en-AU,en;q=0.9",
  "Cache-Control": "no-cache",
};

interface JobData {
  title: string;
  company: string;
  location: string;
  url: string;
  source: "linkedin" | "seek" | "jora";
  workType?: string;
  workArrangement?: string;
  salary?: string;
  description?: string;
  bulletPoints?: string[];
  requiresClearance: boolean;
  requiresCitizenship: boolean;
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

async function fetchHtml(url: string, extraHeaders: Record<string, string> = {}): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { ...FETCH_HEADERS, ...extraHeaders },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[jobExtract] HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[jobExtract] fetch failed for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function extractSeek(url: string): Promise<Partial<JobData> | null> {
  const html = await fetchHtml(url, { Referer: "https://www.seek.com.au/" });
  if (!html) return null;
  try {
    const $ = cheerio.load(html);

    const title = $("[data-automation='job-detail-title']").first().text().trim() ||
      $("h1").first().text().trim() || "";
    const company = $("[data-automation='job-detail-header'] a").first().text().trim() ||
      $("[data-automation='jobAdvertiser']").first().text().trim() || "";
    const location = $("[data-automation='job-detail-location']").first().text().trim() ||
      $("[data-automation='jobLocation']").first().text().trim() || "";
    const salary = $("[data-automation='job-detail-salary']").first().text().trim() || undefined;
    const workType = $("[data-automation='job-detail-work-type']").first().text().trim() || undefined;

    const descEl = $("[data-automation='jobDescription']").first();
    let description = descEl.text().trim();
    if (!description) description = $(".job-details").first().text().trim();
    if (!description) description = $("[data-automation='jobAdDetails']").first().text().trim();

    const bulletPoints = descEl.find("li").map((_, li) => $(li).text().trim()).get().filter(Boolean);

    const allText = `${title} ${company} ${location} ${description}`;

    return {
      title: title || undefined,
      company: company || undefined,
      location: location || undefined,
      workType: workType || undefined,
      workArrangement: extractWorkArrangement(allText),
      salary: salary || undefined,
      description: description || undefined,
      bulletPoints: bulletPoints.length > 0 ? bulletPoints : undefined,
      requiresClearance: requiresClearance(allText),
      requiresCitizenship: requiresCitizenship(allText),
    };
  } catch (err) {
    console.warn("[jobExtract] seek parse error:", err);
    return null;
  }
}

async function extractJora(url: string): Promise<Partial<JobData> | null> {
  const html = await fetchHtml(url);
  if (!html) return null;
  try {
    const $ = cheerio.load(html);

    const title = $("h1.job-title").first().text().trim() ||
      $(".job-title").first().text().trim() || "";
    const company = $(".job-company").first().text().trim() || "";
    const location = $(".job-location").first().text().trim() || "";
    const salary = $(".job-salary").first().text().trim() || undefined;

    const descEl = $(".job-description, .description, [class*='description']").first();
    let description = descEl.text().trim();
    if (!description) description = $(".job-abstract").first().text().trim();

    const bulletPoints = descEl.find("li").map((_, li) => $(li).text().trim()).get().filter(Boolean);

    const allText = `${title} ${company} ${location} ${description}`;

    return {
      title: title || undefined,
      company: company || undefined,
      location: location || undefined,
      salary: salary || undefined,
      description: description || undefined,
      bulletPoints: bulletPoints.length > 0 ? bulletPoints : undefined,
      workArrangement: extractWorkArrangement(allText),
      requiresClearance: requiresClearance(allText),
      requiresCitizenship: requiresCitizenship(allText),
    };
  } catch (err) {
    console.warn("[jobExtract] jora parse error:", err);
    return null;
  }
}

async function extractLinkedIn(url: string): Promise<Partial<JobData> | null> {
  const html = await fetchHtml(url, {
    Referer: "https://www.linkedin.com/jobs/search/",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  });
  if (!html) return null;
  try {
    const $ = cheerio.load(html);

    const title = $("h1.top-card-layout__title, h1.job-details-jobs-unified-top-card__job-title, h1").first().text().trim() || "";
    const company = $("a.topcard__org-name-link, .job-details-jobs-unified-top-card__company-name a, a[href*='company']").first().text().trim() || "";
    const location = $("span.topcard__flavor--bullet, .job-details-jobs-unified-top-card__bullet").first().text().trim() || "";

    let description = "";
    const showMoreBtn = $("[data-test-id='job-description-text'], .description__text, .show-more-less-html__markup, [class*='description']").first();
    if (showMoreBtn.length) {
      description = showMoreBtn.text().trim();
    }
    if (!description) {
      description = $(".job-details-jobs-unified-top-card__job-description, .details").first().text().trim();
    }
    if (!description) {
      description = $("meta[name='description']").attr("content")?.trim() || "";
    }

    const salary = $("[class*='salary'], .compensation__salary").first().text().trim() || undefined;

    const allText = `${title} ${company} ${location} ${description}`;

    return {
      title: title || undefined,
      company: company || undefined,
      location: location || undefined,
      salary: salary || undefined,
      description: description || undefined,
      workArrangement: extractWorkArrangement(allText),
      requiresClearance: requiresClearance(allText),
      requiresCitizenship: requiresCitizenship(allText),
    };
  } catch (err) {
    console.warn("[jobExtract] linkedin parse error:", err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, source, existing } = body;

    if (!url || !source) {
      return NextResponse.json({ error: "Missing url or source" }, { status: 400 });
    }

    // Start with existing data if provided, so we always have a fallback
    const base: JobData = existing || {
      title: "",
      company: "",
      location: "",
      url,
      source,
      requiresClearance: false,
      requiresCitizenship: false,
    };

    let enriched: Partial<JobData> | null = null;
    if (source === "seek") enriched = await extractSeek(url);
    else if (source === "jora") enriched = await extractJora(url);
    else if (source === "linkedin") enriched = await extractLinkedIn(url);
    else {
      return NextResponse.json({ error: "Unknown source" }, { status: 400 });
    }

    // Merge: enriched fields override base, but keep base as fallback
    const merged: JobData = {
      ...base,
      ...(enriched || {}),
      url,
      source,
      // Ensure description is always a string
      description: enriched?.description || base.description || "No detailed description available.",
    };

    return NextResponse.json({
      job: merged,
      enriched: !!enriched, // true if we got extra data, false if we used fallback
    });
  } catch (err) {
    console.error("[jobExtract] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
