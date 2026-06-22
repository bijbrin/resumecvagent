/**
 * lib/scraper/firecrawl.ts
 *
 * Thin wrapper over the Firecrawl v2 REST API. The app has no Firecrawl SDK
 * installed, so we talk to the HTTP API directly with `fetch`. Routing scrapes
 * through Firecrawl (instead of raw `fetch` + cheerio) makes the job scanner
 * resilient: Firecrawl renders JS, rotates proxies, and — via its `json` format
 * — extracts structured data with an LLM, so a board changing its markup no
 * longer silently breaks the scan.
 *
 * Server-only: never import from a client component.
 */
import "server-only";

const FIRECRAWL_BASE = process.env.FIRECRAWL_API_URL?.trim() || "https://api.firecrawl.dev";

function apiKey(): string {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "FIRECRAWL_API_KEY is not set — add it to resumeweb/.env.local to enable the job scanner.",
    );
  }
  return key;
}

interface ScrapeJsonOptions {
  /** Natural-language instruction for the extraction LLM. */
  prompt: string;
  /** JSON schema describing the shape to extract. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Record<string, any>;
  /** Per-request timeout (default 60s — JSON extraction is slower than a plain scrape). */
  timeoutMs?: number;
}

interface FirecrawlScrapeResponse {
  success?: boolean;
  error?: string;
  data?: {
    markdown?: string;
    json?: unknown;
    metadata?: Record<string, unknown>;
    links?: string[];
  };
}

async function postScrape(
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<FirecrawlScrapeResponse | null> {
  try {
    const res = await fetch(`${FIRECRAWL_BASE}/v2/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = (await res.json()) as FirecrawlScrapeResponse;
    if (!res.ok || json.success === false) {
      console.warn(
        `[firecrawl] scrape failed (HTTP ${res.status}) for ${body.url}:`,
        json.error ?? res.statusText,
      );
      return null;
    }
    return json;
  } catch (err) {
    console.warn(
      `[firecrawl] scrape error for ${body.url}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Scrape a URL and have Firecrawl's LLM extract structured data matching
 * `schema`. Returns the parsed object (typed as T) or null on any failure —
 * callers treat null as "this source yielded nothing".
 */
export async function firecrawlScrapeJson<T>(
  url: string,
  { prompt, schema, timeoutMs = 60_000 }: ScrapeJsonOptions,
): Promise<T | null> {
  const json = await postScrape(
    {
      url,
      onlyMainContent: true,
      formats: [{ type: "json", prompt, schema }],
    },
    timeoutMs,
  );
  return (json?.data?.json as T | undefined) ?? null;
}

export interface MarkdownScrape {
  markdown: string;
  metadata: Record<string, unknown>;
  links: string[];
}

/**
 * Scrape a single URL to clean markdown (plus metadata + links). Used by the
 * detail endpoint to pull a full job description on demand.
 */
export async function firecrawlScrapeMarkdown(
  url: string,
  timeoutMs = 45_000,
): Promise<MarkdownScrape | null> {
  const json = await postScrape(
    { url, onlyMainContent: true, formats: ["markdown", "links"] },
    timeoutMs,
  );
  if (!json?.data?.markdown) return null;
  return {
    markdown: json.data.markdown,
    metadata: json.data.metadata ?? {},
    links: json.data.links ?? [],
  };
}
