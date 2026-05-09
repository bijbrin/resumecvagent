import "server-only";
import type { ChatMessage, LLMOptions } from "./anthropic";

// ─── Endpoints ────────────────────────────────────────────────────────────────
//
// Moonshot publishes TWO API gateways:
//   1. api.moonshot.cn/v1   — China-region endpoint (keys from platform.moonshot.cn)
//   2. api.moonshot.ai/v1   — International endpoint (same key format, better latency
//                              outside China; use KIMI_BASE_URL to point here)
//
// Kimi Code (kimi.com/code) may use a different model name such as "kimi-k2-0711-preview".
// Set KIMI_MODEL_OVERRIDE in .env.local if your key is provisioned for a non-standard model.

const DEFAULT_BASE_URL = "https://api.moonshot.cn/v1";

// Read at call time (not module load) so hot-reload picks up .env.local changes.
function kimiBaseUrl(): string {
  return (process.env.KIMI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

const DEFAULT_MODEL = "moonshot-v1-32k";
export const KIMI_MODEL = DEFAULT_MODEL;

function kimiModel(optionsModel?: string): string {
  return process.env.KIMI_MODEL_OVERRIDE ?? optionsModel ?? DEFAULT_MODEL;
}

interface MoonshotChoice {
  message: { content: string | null };
}

interface MoonshotResponse {
  choices?: MoonshotChoice[];
  error?:   { message: string; type?: string };
}

export async function kimiGenerateText(
  messages: ChatMessage[],
  options:  LLMOptions = {},
): Promise<string> {
  const apiKey = process.env.KIMI_API_KEY?.trim();
  if (!apiKey) throw new Error("KIMI_API_KEY is not set.");

  const baseUrl = kimiBaseUrl();
  const model   = kimiModel(options.model);
  const { temperature = 0.3, maxTokens = 2048, systemPrompt } = options;

  const url = `${baseUrl}/chat/completions`;
  console.log(`[kimi] POST ${url} model=${model} key=...${apiKey.slice(-6)}`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          ...messages,
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    // "fetch failed" = TCP-level failure (DNS, geo-block, timeout).
    // Likely api.moonshot.cn is unreachable — try setting KIMI_BASE_URL=https://api.moonshot.ai/v1
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Kimi connection failed to ${url}: ${msg}. ` +
      "If you are outside China, set KIMI_BASE_URL=https://api.moonshot.ai/v1 in .env.local.",
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Kimi API error ${res.status} at ${url}: ${body}`);
  }

  const data = (await res.json()) as MoonshotResponse;
  if (data.error) throw new Error(`Kimi API error: ${data.error.message}`);

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Kimi returned an empty response.");

  return content;
}
