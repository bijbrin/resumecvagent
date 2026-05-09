import "server-only";
import type { ChatMessage, LLMOptions } from "./anthropic";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

export const OPENAI_EXTRACTION_MODEL = "gpt-4o-mini";
export const OPENAI_REASONING_MODEL  = "gpt-4o";

interface OpenAIChoice {
  message: { content: string | null };
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
  error?: { message: string; type?: string };
}

export async function openaiGenerateText(
  messages: ChatMessage[],
  options:  LLMOptions = {},
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "sk-...") {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const {
    model       = OPENAI_EXTRACTION_MODEL,
    temperature = 0.3,
    maxTokens   = 2048,
    systemPrompt,
  } = options;

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
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
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as OpenAIResponse;
  if (data.error) throw new Error(`OpenAI API error: ${data.error.message}`);

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");

  return content;
}
