import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { firecrawlScrapeMarkdown } from "@/lib/scraper/firecrawl";
import { buildTags, type JobTags } from "@/lib/scraper/jobTags";

// On-demand single-page scrape — fast, but still a network round-trip to Firecrawl.
export const runtime = "nodejs";
export const maxDuration = 60;

export interface JobDetail {
  url: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  companyUrl?: string;
  /** Full job description as markdown. */
  markdown: string;
  tags: JobTags;
}

/** Best-effort: find the employer's own website among the scraped page links. */
function pickCompanyUrl(jobUrl: string, links: string[]): string | undefined {
  let host: string;
  try {
    host = new URL(jobUrl).hostname;
  } catch {
    host = "";
  }
  const boardHosts = [
    "seek.com.au",
    "jora.com",
    "indeed.com",
    "adzuna.com.au",
    "linkedin.com",
    "glassdoor.com",
    "wellfound.com",
    "hays.com.au",
    "google.com",
    host,
  ];
  const skip = (l: string) =>
    boardHosts.some((h) => l.includes(h)) ||
    /facebook|twitter|instagram|youtube|x\.com|tiktok|mailto:|javascript:/i.test(l);

  const candidate = links.find((l) => /^https?:\/\//.test(l) && !skip(l));
  return candidate;
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "A valid ?url= is required" }, { status: 400 });
  }

  const scrape = await firecrawlScrapeMarkdown(url);
  if (!scrape) {
    return NextResponse.json(
      { error: "Could not load that job posting. Try opening it directly." },
      { status: 502 },
    );
  }

  const md = scrape.metadata;
  const title = String(md.ogTitle ?? md.title ?? "").trim();
  const company =
    String(md["og:site_name"] ?? md.ogSiteName ?? md.author ?? "").trim();

  const detail: JobDetail = {
    url,
    title,
    company,
    location: "",
    companyUrl: pickCompanyUrl(url, scrape.links),
    markdown: scrape.markdown,
    // Tags from the FULL description are more accurate than the search snippet.
    tags: buildTags(title, scrape.markdown),
  };

  return NextResponse.json(detail);
}
