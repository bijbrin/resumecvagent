import "server-only";
import type { ChatMessage, LLMOptions } from "./anthropic";

// ─── OpenRouter (OpenAI-compatible gateway) ─────────────────────────────────────
//
// OpenRouter exposes a single OpenAI-style /chat/completions endpoint that
// proxies to dozens of upstream models (DeepSeek, Kimi, Claude, GPT, …). One
// API key, one base URL — switch models by changing the `model` id only.
//
// This is the PRIMARY provider for the app. The hub in ./anthropic.ts falls
// back to Kimi → OpenAI → Anthropic if OpenRouter is unavailable.

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

// Read at call time (not module load) so hot-reload picks up .env.local changes.
function openrouterBaseUrl(): string {
  return (process.env.OPENROUTER_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

// ─── Model tiers (env-overridable) ──────────────────────────────────────────────
// `extraction` = cheap/fast structured extraction; `reasoning` = stronger synthesis.
// Both default to the same DeepSeek model — capable enough for both jobs — but can
// be split via env. PRIMARY is tried first; FALLBACK is tried within OpenRouter
// before the hub degrades to another provider.
// Model ids accept either OPENROUTER_* or the shorter LLM_* env names.
export const OPENROUTER_EXTRACTION_MODEL =
  process.env.OPENROUTER_MODEL ?? process.env.LLM_MODEL ?? "deepseek/deepseek-v4-flash";
export const OPENROUTER_REASONING_MODEL =
  process.env.OPENROUTER_REASONING_MODEL ?? process.env.LLM_REASONING_MODEL ?? OPENROUTER_EXTRACTION_MODEL;
export const OPENROUTER_FALLBACK_MODEL =
  process.env.OPENROUTER_FALLBACK_MODEL ?? process.env.LLM_FALLBACK_MODEL ?? "deepseek/deepseek-v3.2";

interface OpenRouterChoice {
  message: { content: string | null; reasoning?: string | null };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  error?:   { message: string; code?: number };
}

async function callOpenRouter(
  model:    string,
  messages: ChatMessage[],
  options:  LLMOptions,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  const { temperature = 0.3, maxTokens = 2048, systemPrompt } = options;
  const url = `${openrouterBaseUrl()}/chat/completions`;
  console.log(`[openrouter] POST ${url} model=${model} key=...${apiKey.slice(-6)}`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
        // Optional attribution headers OpenRouter surfaces in its dashboard.
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
        "X-Title":      process.env.OPENROUTER_APP_NAME ?? "ResumeCVAgent",
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
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenRouter connection failed to ${url}: ${msg}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`OpenRouter API error ${res.status} at ${url}: ${body}`);
  }

  const data = (await res.json()) as OpenRouterResponse;
  if (data.error) throw new Error(`OpenRouter API error: ${data.error.message}`);

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned an empty response.");

  return content;
}

// ─── openrouterGenerateText ─────────────────────────────────────────────────────
// Tries the requested (or primary) model, then OPENROUTER_FALLBACK_MODEL, both
// within OpenRouter — so a single model outage degrades gracefully before the hub
// switches providers entirely.
export async function openrouterGenerateText(
  messages: ChatMessage[],
  options:  LLMOptions = {},
): Promise<string> {
  const primary  = options.model ?? OPENROUTER_EXTRACTION_MODEL;
  const chain    = primary === OPENROUTER_FALLBACK_MODEL
    ? [primary]
    : [primary, OPENROUTER_FALLBACK_MODEL];

  const errors: string[] = [];
  for (const model of chain) {
    try {
      return await callOpenRouter(model, messages, options);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[openrouter] model ${model} failed: ${msg}`);
      errors.push(`${model}: ${msg}`);
    }
  }
  throw new Error(`OpenRouter failed for all models.\n${errors.join("\n")}`);
}
