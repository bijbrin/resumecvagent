/**
 * lib/scraper/jobTags.ts
 *
 * Shared job-listing type + pure text detectors used by both the scan route and
 * the detail route. Keeping these in one module means a tag computed on a
 * search-result snippet and the same tag computed on a full job description use
 * identical logic. No I/O here — safe to import anywhere.
 */

export type JobSource = "seek" | "jora" | "indeed" | "linkedin" | "adzuna" | "other";

export type WorkArrangement = "Remote" | "Hybrid" | "On-site";

/**
 * "City" = Sydney / Melbourne / Brisbane (excluded from the 491 Regional visa);
 * "Regional" = everywhere else in Australia (491-eligible). Relevant because the
 * candidate holds a 491 Regional visa.
 */
export type LocationType = "City" | "Regional";

export interface JobTags {
  /** Public-sector / government role. */
  government: boolean;
  /** Requires a security clearance (NV1/NV2/Baseline/TSPV…). */
  clearance: boolean;
  /** Requires Australian citizenship or PR. */
  citizenship: boolean;
  arrangement?: WorkArrangement;
  workType?: string;
  seniority?: string;
  /** City (Sydney/Melbourne/Brisbane) vs Regional (491-eligible). */
  locationType?: LocationType;
  /** Recognised tech-stack keywords found in the text. */
  tech: string[];
}

export interface JobListing {
  title: string;
  company: string;
  location: string;
  url: string;
  postedAt: string;
  source: JobSource;
  salary?: string;
  summary?: string;
  /** LinkedIn can't be auto-scraped — the user pastes the JD in the drawer. */
  needsManualJd?: boolean;
  tags: JobTags;
}

// ── Detectors ───────────────────────────────────────────────────────────────

export function extractWorkArrangement(text: string): WorkArrangement | undefined {
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
  if (t.includes("hybrid")) return "Hybrid";
  if (t.includes("remote")) return "Remote";
  if (
    t.includes("on-site") ||
    t.includes("onsite") ||
    t.includes("in office") ||
    t.includes("in-office") ||
    t.includes("office based") ||
    t.includes("office-based")
  )
    return "On-site";
  return undefined;
}

export function requiresClearance(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("security clearance") ||
    t.includes("nv1") ||
    t.includes("nv2") ||
    t.includes("baseline clearance") ||
    t.includes("baseline security") ||
    t.includes("top secret") ||
    t.includes("secret clearance") ||
    t.includes("clearance required") ||
    t.includes("security cleared") ||
    t.includes("must hold clearance") ||
    t.includes("positive vetting") ||
    t.includes("tspv") ||
    t.includes("agsva")
  );
}

export function requiresCitizenship(text: string): boolean {
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

export function isGovernment(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes(".gov.au") ||
    t.includes("australian public service") ||
    /\baps\s?[1-6]\b/.test(t) ||
    /\bel\s?[12]\b/.test(t) || // Executive Level
    t.includes("aps level") ||
    t.includes("government department") ||
    t.includes("federal government") ||
    t.includes("state government") ||
    t.includes("local government") ||
    t.includes("public sector") ||
    t.includes("department of ") ||
    t.includes("city council") ||
    t.includes("shire council") ||
    t.includes("defence") ||
    t.includes("department of defence") ||
    t.includes("services australia") ||
    t.includes("ato") ||
    t.includes("centrelink")
  );
}

const WORK_TYPES: Array<[string, RegExp]> = [
  ["Full time", /\bfull[-\s]?time\b/i],
  ["Part time", /\bpart[-\s]?time\b/i],
  ["Contract", /\bcontract\b|\bfixed[-\s]?term\b/i],
  ["Casual", /\bcasual\b/i],
  ["Internship", /\binternship\b|\bintern\b/i],
  ["Temporary", /\btemporary\b|\btemp\b/i],
];

export function detectWorkType(text: string): string | undefined {
  for (const [label, re] of WORK_TYPES) {
    if (re.test(text)) return label;
  }
  return undefined;
}

const SENIORITY: Array<[string, RegExp]> = [
  ["Graduate", /\bgraduate\b|\bentry[-\s]?level\b/i],
  ["Junior", /\bjunior\b|\bjnr\b/i],
  ["Principal", /\bprincipal\b/i],
  ["Lead", /\blead\b|\bstaff\b|\bhead of\b/i],
  ["Senior", /\bsenior\b|\bsnr\b|\bsr\.?\b/i],
];

export function detectSeniority(title: string): string | undefined {
  // Order matters: principal/lead/senior beat the generic check; graduate first
  // so "graduate engineer" isn't mislabelled.
  for (const [label, re] of SENIORITY) {
    if (re.test(title)) return label;
  }
  return undefined;
}

// Curated stack keywords → canonical display label. Matched case-insensitively
// with word boundaries so "go" doesn't match "good".
const TECH_KEYWORDS: Array<[string, RegExp]> = [
  ["React", /\breact(?:\.js)?\b/i],
  ["Next.js", /\bnext\.?js\b/i],
  ["Node.js", /\bnode(?:\.js)?\b/i],
  ["TypeScript", /\btypescript\b|\bts\b/i],
  ["JavaScript", /\bjavascript\b/i],
  ["Python", /\bpython\b/i],
  ["Java", /\bjava\b(?!script)/i],
  ["C#", /\bc#\b|\b\.net\b|\bdotnet\b/i],
  ["Go", /\bgolang\b/i],
  ["Rust", /\brust\b/i],
  ["PHP", /\bphp\b/i],
  ["Ruby", /\bruby\b/i],
  ["SQL", /\bsql\b|\bpostgres\b|\bpostgresql\b|\bmysql\b/i],
  ["MongoDB", /\bmongodb\b|\bmongo\b/i],
  ["AWS", /\baws\b|\bamazon web services\b/i],
  ["Azure", /\bazure\b/i],
  ["GCP", /\bgcp\b|\bgoogle cloud\b/i],
  ["Docker", /\bdocker\b/i],
  ["Kubernetes", /\bkubernetes\b|\bk8s\b/i],
  ["Terraform", /\bterraform\b/i],
  ["GraphQL", /\bgraphql\b/i],
  ["Vue", /\bvue(?:\.js)?\b/i],
  ["Angular", /\bangular\b/i],
];

export function detectTechStack(text: string, max = 6): string[] {
  const found: string[] = [];
  for (const [label, re] of TECH_KEYWORDS) {
    if (re.test(text)) found.push(label);
    if (found.length >= max) break;
  }
  return found;
}

// Capital cities that are NOT eligible for the 491 Regional visa.
const CITY_REGIONS = [/\bsydney\b/i, /\bmelbourne\b/i, /\bbrisbane\b/i];

/**
 * Classify a location string as "City" (Sydney/Melbourne/Brisbane) or
 * "Regional" (anywhere else in Australia). Returns undefined when no location
 * is given (a bare "Remote" with no place stays untagged).
 */
export function detectLocationType(location: string): LocationType | undefined {
  const loc = location?.trim();
  if (!loc) return undefined;
  return CITY_REGIONS.some((re) => re.test(loc)) ? "City" : "Regional";
}

/**
 * Compute the full tag set. `title` drives seniority, `location` drives the
 * City/Regional classification, and the combined text drives everything else.
 */
export function buildTags(title: string, text: string, location = ""): JobTags {
  const all = `${title} ${text}`;
  return {
    government: isGovernment(all),
    clearance: requiresClearance(all),
    citizenship: requiresCitizenship(all),
    arrangement: extractWorkArrangement(all),
    workType: detectWorkType(all),
    seniority: detectSeniority(title),
    locationType: detectLocationType(location),
    tech: detectTechStack(all),
  };
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

export function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return "";
  // Already-human strings ("Posted 2d ago", "3 days ago") pass through.
  if (/ago|posted|just now/i.test(dateStr)) {
    return dateStr.replace(/^posted\s+/i, "").trim();
  }
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

/** Normalise a URL for dedup: drop query string + fragment + trailing slash. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.split("?")[0].split("#")[0].replace(/\/$/, "").toLowerCase();
  }
}
