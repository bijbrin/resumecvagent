/**
 * lib/scraper/linkedinScraper.ts
 *
 * Two extraction strategies for LinkedIn job pages:
 *
 * 1. extractLinkedInFromHtml() — CSS-selector based, works on server-rendered
 *    HTML returned by a plain HTTP GET (no Firecrawl needed). Uses cheerio to
 *    target the stable class names LinkedIn embeds in every job posting page.
 *    Key selectors (confirmed against live responses 2024-12):
 *      - Description: div.show-more-less-html__markup
 *      - Title/Company: <title> "{Company} hiring {Role} | {Location} | LinkedIn"
 *      - Location fallback: .job-details-jobs-unified-top-card__bullet
 *      - Employment type: .job-details-jobs-unified-top-card__job-insight
 *
 * 2. parseLinkedInText() — heuristic text parser. Used as fallback when HTML
 *    selectors yield nothing (e.g., Firecrawl markdown path, bot-protected responses).
 */

import * as cheerio from "cheerio";

// ─── UI chrome patterns to discard ───────────────────────────────────────────
// Lines whose lowercase form contains any of these are skipped when looking
// for title / company / location — they are LinkedIn navigation / auth UI.

const SKIP_PATTERNS = [
  "linkedin", "sign in", "join now", "skip to main content",
  "join or sign in", "apply", "save", "report this job",
  "agree & join", "continue", "not you", "remove photo",
  "first name", "last name", "email", "password",
  "user agreement", "privacy policy", "cookie policy",
  "you may also apply directly on", "company website",
  "see who", "has hired for this role", "applicants",
  "days ago", "hours ago", "minutes ago", "reposted",
  "easy apply", "promoted", "follow", "message",
  "show more", "show less", "get alerts",
];

function isSkipLine(line: string): boolean {
  const lower = line.toLowerCase();
  return SKIP_PATTERNS.some((p) => lower.includes(p));
}

// ─── Description section markers ─────────────────────────────────────────────
// The actual job content always starts after one of these headings.

const DESC_MARKERS = [
  "about the job",
  "job description",
  "about the role",
  "what you'll do",
  "what you will do",
  "responsibilities",
  "the role",
  "this role involves",
  "we are looking for",
  "about this role",
  "position overview",
  "role overview",
  "your responsibilities",
  "key responsibilities",
];

// ─── Output type ──────────────────────────────────────────────────────────────

export interface ParsedLinkedIn {
  title:           string;
  company:         string;
  companyLinkedin: string;
  location:        string;
  employmentType:  string;
  description:     string;
  rawText:         string;
}

// ─── CSS-selector extractor (server-rendered HTML) ───────────────────────────
// LinkedIn serves a fully populated job card in the initial HTML response.
// No JS rendering or Firecrawl required.

export function extractLinkedInFromHtml(html: string, url: string): ParsedLinkedIn | null {
  const $ = cheerio.load(html);

  // ── Description ─────────────────────────────────────────────────────────────
  // Primary: the rich-text div that holds the full job description.
  let description = $("div.show-more-less-html__markup").first().text().trim();

  // Secondary: broader rich-text container used on some variants.
  if (!description) {
    description = $(".description__text--rich").text().trim();
  }

  if (!description || description.length < 100) return null;

  // ── Title + Company from <title> ─────────────────────────────────────────────
  // Format: "{Company} hiring {Role} | {Location} | LinkedIn"
  let title   = "";
  let company = "";
  let location = "";

  const pageTitle = $("title").first().text().trim();
  if (pageTitle) {
    // "{Company} hiring {Role} | {Location} | LinkedIn"
    const hiringMatch = /^(.+?)\s+hiring\s+(.+?)\s*\|\s*(.+?)\s*\|\s*LinkedIn/i.exec(pageTitle);
    if (hiringMatch) {
      company  = hiringMatch[1].trim();
      title    = hiringMatch[2].trim();
      location = hiringMatch[3].trim();
    } else {
      // Fallback: "{Role} | {Company} | LinkedIn"
      const pipeMatch = /^(.+?)\s*\|\s*(.+?)\s*\|\s*LinkedIn/i.exec(pageTitle);
      if (pipeMatch) {
        title   = pipeMatch[1].trim();
        company = pipeMatch[2].trim();
      }
    }
  }

  // ── Title from canonical URL slug if still missing ───────────────────────────
  // e.g. /jobs/view/software-engineer-frontend-remote-at-crossing-hurdles-4377667990
  if (!title) {
    const slugMatch = /\/jobs\/view\/([^/?#]+)/i.exec(url);
    if (slugMatch) {
      title = slugMatch[1]
        .replace(/-at-.+$/, "")      // strip "-at-company" suffix
        .replace(/-\d+$/, "")        // strip trailing job ID
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
    }
  }

  // ── Location from top-card bullets ──────────────────────────────────────────
  if (!location) {
    $(".job-details-jobs-unified-top-card__bullet, .topcard__flavor--bullet").each((_, el) => {
      const t = $(el).text().trim();
      if (t && t.length < 80) { location = t; return false; }
    });
  }

  // ── Employment type ─────────────────────────────────────────────────────────
  let employmentType = "";
  $(".job-details-jobs-unified-top-card__job-insight, .description__job-criteria-text").each((_, el) => {
    const t = $(el).text().trim();
    if (/full[-\s]?time|part[-\s]?time|contract|temporary|internship|casual|permanent/i.test(t)) {
      employmentType = t;
      return false;
    }
  });

  // ── Company LinkedIn URL ─────────────────────────────────────────────────────
  let companyLinkedin = "";
  const companyMatch = /linkedin\.com\/company\/([^/"'\s?]+)/i.exec(html);
  if (companyMatch) {
    companyLinkedin = `https://www.linkedin.com/company/${companyMatch[1]}`;
  }

  return {
    title,
    company,
    companyLinkedin,
    location,
    employmentType,
    description,
    rawText: description.slice(0, 15_000),
  };
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseLinkedInText(
  text: string,
  html: string,
  _url: string,
): ParsedLinkedIn {
  const result: ParsedLinkedIn = {
    title:           "",
    company:         "",
    companyLinkedin: "",
    location:        "",
    employmentType:  "",
    description:     "",
    rawText:         text.slice(0, 15_000),
  };

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // ── Title + company ────────────────────────────────────────────────────────
  // Strategy A: first capitalised non-skip line as title, next non-skip as company.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length > 150 || isSkipLine(line)) continue;
    if (line[0] !== line[0].toUpperCase()) continue;
    const next = (lines[i + 1] ?? "").trim();
    if (next && !isSkipLine(next) && next.length < 100) {
      result.title   = line;
      result.company = next;
      break;
    }
  }

  // Strategy B (fallback): "{Company} hiring {Role} in {Location}"
  if (!result.title) {
    for (const line of lines) {
      if (!line || line.length >= 120 || isSkipLine(line)) continue;
      const lower = line.toLowerCase();
      if (lower.includes("hiring") && lower.includes(" in ")) {
        const hiringIdx = lower.indexOf("hiring");
        const inIdx     = lower.indexOf(" in ", hiringIdx);
        result.company = line.slice(0, hiringIdx).trim();
        result.title   = line.slice(hiringIdx + "hiring".length, inIdx).trim();
        result.location = line.slice(inIdx + " in ".length).trim();
        break;
      }
    }
  }

  // ── Location — "City · Hybrid" pattern in first 60 lines ──────────────────
  if (!result.location) {
    for (const line of lines.slice(0, 60)) {
      if (!line.includes("·")) continue;
      const first = line.split("·")[0].trim();
      if (first.length < 60 && !isSkipLine(first)) {
        result.location = line;
        break;
      }
    }
  }

  // ── Employment type in first 60 lines ─────────────────────────────────────
  for (const line of lines.slice(0, 60)) {
    if (line.length >= 60) continue;
    const lower = line.toLowerCase();
    if (/full[-\s]?time|part[-\s]?time|contract|temporary|internship|casual|permanent/.test(lower)) {
      result.employmentType = line;
      break;
    }
  }

  // ── Description — search for section marker, else first long paragraph ────
  const lowerText = text.toLowerCase();
  let descStart   = -1;
  for (const marker of DESC_MARKERS) {
    const idx = lowerText.indexOf(marker);
    if (idx !== -1) { descStart = idx; break; }
  }

  if (descStart !== -1) {
    result.description = text.slice(descStart, descStart + 10_000).trim();
  } else {
    // Fallback: first line longer than 200 chars and everything after it.
    const longIdx = lines.findIndex((l) => l.length > 200);
    if (longIdx !== -1) {
      result.description = lines.slice(longIdx, longIdx + 60).join("\n");
    }
  }

  // ── Company LinkedIn page from raw HTML ────────────────────────────────────
  const companyMatch = /linkedin\.com\/company\/([^/"'\s?]+)/i.exec(html);
  if (companyMatch) {
    result.companyLinkedin = `https://www.linkedin.com/company/${companyMatch[1]}`;
  }

  return result;
}

// ─── Format for LLM ───────────────────────────────────────────────────────────
// Produces a clean, structured text block that gives the LLM unambiguous fields
// instead of raw page chrome to untangle.

export function formatLinkedInForLLM(parsed: ParsedLinkedIn): string {
  const lines: string[] = [];

  if (parsed.title)          lines.push(`JOB TITLE: ${parsed.title}`);
  if (parsed.company)        lines.push(`COMPANY: ${parsed.company}`);
  if (parsed.location)       lines.push(`LOCATION: ${parsed.location}`);
  if (parsed.employmentType) lines.push(`EMPLOYMENT TYPE: ${parsed.employmentType}`);
  if (parsed.companyLinkedin) lines.push(`COMPANY LINKEDIN: ${parsed.companyLinkedin}`);

  if (parsed.description) {
    lines.push("", "JOB DESCRIPTION:", parsed.description.slice(0, 8_000));
  } else if (parsed.rawText) {
    lines.push("", "RAW PAGE TEXT (use to infer job details):", parsed.rawText.slice(0, 6_000));
  }

  return lines.join("\n");
}
