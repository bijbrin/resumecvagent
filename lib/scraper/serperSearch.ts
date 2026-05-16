import "server-only";

const SERPER_URL = "https://google.serper.dev/search";

interface SerperOrganic {
  title: string;
  snippet: string;
  link: string;
}

interface SerperResult {
  organic?: SerperOrganic[];
  knowledgeGraph?: { description?: string; attributes?: Record<string, string> };
  answerBox?: { answer?: string; snippet?: string };
}

export async function serperCompanySearch(companyName: string): Promise<string | null> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;

  const queries = [
    `${companyName} company mission values culture`,
    `${companyName} recent news 2025`,
  ];

  const parts: string[] = [];

  for (const q of queries) {
    try {
      const res = await fetch(SERPER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({ q, num: 5 }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        console.warn(`[serperSearch] HTTP ${res.status} for query: ${q}`);
        continue;
      }

      const data = (await res.json()) as SerperResult;

      if (data.knowledgeGraph?.description)
        parts.push(`Overview: ${data.knowledgeGraph.description}`);
      if (data.answerBox?.snippet)
        parts.push(`Answer: ${data.answerBox.snippet}`);

      for (const r of data.organic?.slice(0, 4) ?? []) {
        if (r.snippet) parts.push(`${r.title}: ${r.snippet}`);
      }
    } catch (err) {
      console.warn(
        `[serperSearch] Query failed ("${q}"):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (parts.length === 0) return null;
  console.log(`[serperSearch] ${parts.length} snippets collected for "${companyName}"`);
  return parts.join("\n\n");
}
