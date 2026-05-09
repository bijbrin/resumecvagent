import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { kimiGenerateText, KIMI_MODEL } from "./kimi";
import { openaiGenerateText, OPENAI_EXTRACTION_MODEL, OPENAI_REASONING_MODEL } from "./openai";

// Singleton Anthropic client — created once, reused across requests.
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return _client;
}

// ─── Model constants ──────────────────────────────────────────────────────────
// Kimi models — used as defaults when calling via the fallback chain.
export const EXTRACTION_MODEL = KIMI_MODEL;              // moonshot-v1-32k
export const REASONING_MODEL  = KIMI_MODEL;              // moonshot-v1-32k

// Anthropic fallback models (used when Kimi is unavailable).
export const ANTHROPIC_EXTRACTION_MODEL = "claude-haiku-4-5-20251001";
export const ANTHROPIC_REASONING_MODEL  = "claude-sonnet-4-6";

export type LLMProvider = "kimi" | "anthropic" | "openai";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?:        string;
  temperature?:  number;
  maxTokens?:    number;
  systemPrompt?: string;
}

// ─── anthropicGenerateText (internal primitive) ────────────────────────────────
// Direct Anthropic call — used only when Kimi is unavailable.

async function anthropicGenerateText(
  messages:  ChatMessage[],
  options:   LLMOptions = {},
): Promise<string> {
  const {
    model        = ANTHROPIC_EXTRACTION_MODEL,
    temperature  = 0.3,
    maxTokens    = 2048,
    systemPrompt,
  } = options;

  const response = await client().messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages,
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected non-text block from Anthropic");
  return block.text;
}

// ─── generateText ─────────────────────────────────────────────────────────────
// Public entry point for a single LLM call. Tries Kimi first.
// Falls back to Anthropic, then OpenAI. Throws if all three fail.

export async function generateText(
  messages: ChatMessage[],
  options:  LLMOptions = {},
): Promise<string> {
  const { text } = await generateTextWithFallback(messages, options);
  return text;
}

// ─── generateTextWithFallback ─────────────────────────────────────────────────
// Priority: Kimi → Anthropic → OpenAI.
// Returns { text, provider } so callers can warn when a fallback was used.

export async function generateTextWithFallback(
  messages: ChatMessage[],
  options:  LLMOptions = {},
): Promise<{ text: string; provider: LLMProvider }> {
  const errors: string[] = [];

  // 1. Kimi (Moonshot) ─────────────────────────────────────────────────────────
  if (process.env.KIMI_API_KEY) {
    try {
      const text = await kimiGenerateText(messages, options);
      return { text, provider: "kimi" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm] Kimi failed: ${msg}`);
      errors.push(`Kimi: ${msg}`);
    }
  } else {
    errors.push("Kimi: KIMI_API_KEY not set");
  }

  // 2. OpenAI ───────────────────────────────────────────────────────────────────
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-...") {
    try {
      const openaiOptions = {
        ...options,
        model: options.model === KIMI_MODEL ? OPENAI_EXTRACTION_MODEL : options.model,
      };
      const text = await openaiGenerateText(messages, openaiOptions);
      console.log(`[llm] Using OpenAI fallback (Kimi unavailable).`);
      return { text, provider: "openai" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm] OpenAI failed: ${msg}`);
      errors.push(`OpenAI: ${msg}`);
    }
  } else {
    errors.push("OpenAI: OPENAI_API_KEY not set");
  }

  // 3. Anthropic (last resort) ──────────────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropicOptions = {
        ...options,
        model: options.model === KIMI_MODEL ? ANTHROPIC_EXTRACTION_MODEL : options.model,
      };
      const text = await anthropicGenerateText(messages, anthropicOptions);
      console.log(`[llm] Using Anthropic last-resort fallback.`);
      return { text, provider: "anthropic" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm] Anthropic failed: ${msg}`);
      errors.push(`Anthropic: ${msg}`);
    }
  } else {
    errors.push("Anthropic: ANTHROPIC_API_KEY not set");
  }

  throw new Error(`All LLM providers failed.\n${errors.join("\n")}`);
}

// ─── Structured output helpers ────────────────────────────────────────────────

function parseStructuredResponse<T>(text: string, schema: z.ZodSchema<T>): T {
  const cleaned = text
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM returned non-JSON. First 300 chars: ${cleaned.slice(0, 300)}`);
  }

  return schema.parse(raw);
}

function jsonSystemPrompt(base?: string): string {
  return [
    base ?? "",
    "IMPORTANT: Respond with a single valid JSON object only. No markdown fences, no commentary — raw JSON.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// structuredOutput — uses the full Kimi → Anthropic → OpenAI chain.
export async function structuredOutput<T>(
  messages: ChatMessage[],
  schema:   z.ZodSchema<T>,
  options:  LLMOptions = {},
): Promise<T> {
  const { result } = await structuredOutputWithFallback(messages, schema, options);
  return result;
}

// structuredOutputWithFallback — same as structuredOutput but returns provider too.
export async function structuredOutputWithFallback<T>(
  messages: ChatMessage[],
  schema:   z.ZodSchema<T>,
  options:  LLMOptions = {},
): Promise<{ result: T; provider: LLMProvider }> {
  const { text, provider } = await generateTextWithFallback(messages, {
    ...options,
    systemPrompt: jsonSystemPrompt(options.systemPrompt),
    temperature:  options.temperature ?? 0.1,
  });

  return { result: parseStructuredResponse(text, schema), provider };
}
