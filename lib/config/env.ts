/**
 * Server-only environment validation.
 *
 * Import this ONLY in server components, Route Handlers, and agent code.
 * Never import it inside a Client Component — Next.js will error because
 * server-only vars are stripped from the browser bundle.
 *
 * Validation runs the moment this module is first imported. If a required
 * var is missing the app throws immediately with a clear field-level error
 * rather than blowing up mid-request with a cryptic undefined.
 */

import "server-only"; // hard error if accidentally imported on the client
import { z } from "zod";

// ─── Schema ──────────────────────────────────────────────────────────────────

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // ── Database ──────────────────────────────────────────────────────────
  // z.string().url() is deprecated in Zod v4; connection strings like
  // postgresql:// are valid URLs but z.url() returns a URL object, not a
  // string, so we validate format with a simple regex instead.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required").regex(
    /^(postgresql|postgres):\/\//,
    "DATABASE_URL must be a postgresql:// connection string"
  ),
  // DIRECT_URL is used only by the Prisma CLI (not imported by the app).
  // We validate it exists so a missing value fails fast at startup rather
  // than silently breaking db push / migrate commands.
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required").regex(
    /^(postgresql|postgres):\/\//,
    "DIRECT_URL must be a postgresql:// connection string"
  ).optional(), // optional until the user sets it — Prisma CLI will validate at runtime

  // ── LLM providers ─────────────────────────────────────────────────────
  // OpenRouter is the PRIMARY provider (OpenAI-compatible gateway). The hub in
  // lib/llm/anthropic.ts falls back OpenRouter → Kimi → OpenAI → Anthropic, so
  // all keys are optional individually — at least one must be set (enforced below).
  OPENROUTER_API_KEY:  z.string().min(1).optional(),
  // Override the OpenRouter base URL (defaults to https://openrouter.ai/api/v1).
  OPENROUTER_BASE_URL: z.string().url().optional(),
  // Override the default models. Defaults: deepseek/deepseek-v4-flash (primary),
  // deepseek/deepseek-v3.2 (in-provider fallback).
  OPENROUTER_MODEL:           z.string().min(1).optional(),
  OPENROUTER_REASONING_MODEL: z.string().min(1).optional(),
  OPENROUTER_FALLBACK_MODEL:  z.string().min(1).optional(),
  // Shorter aliases (used if the OPENROUTER_* equivalents above are unset).
  LLM_MODEL:           z.string().min(1).optional(),
  LLM_REASONING_MODEL: z.string().min(1).optional(),
  LLM_FALLBACK_MODEL:  z.string().min(1).optional(),
  // Optional attribution headers shown in the OpenRouter dashboard.
  OPENROUTER_SITE_URL: z.string().url().optional(),
  OPENROUTER_APP_NAME: z.string().min(1).optional(),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  KIMI_API_KEY:   z.string().min(1).optional(),
  // Override the Kimi base URL. Defaults to api.moonshot.ai/v1 (international);
  // set to api.moonshot.cn/v1 for China-region keys.
  KIMI_BASE_URL:  z.string().url().optional(),
  // Override the default model (kimi-k2.6) — set when your key is provisioned
  // for a legacy model (e.g. moonshot-v1-128k).
  KIMI_MODEL_OVERRIDE: z.string().min(1).optional(),

  // ── Kimi feature flags (gate the parallel Kimi agent variants) ─────────
  USE_KIMI_STRATEGY:     z.coerce.boolean().default(false),
  USE_KIMI_WRITER:       z.coerce.boolean().default(false),
  USE_KIMI_COVER_LETTER: z.coerce.boolean().default(false),

  // ── Artifact storage (Vercel Blob or S3-compatible) ───────────────────
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),

  // ── Optional enrichment services ──────────────────────────────────────
  FIRECRAWL_API_KEY: z.string().min(1).optional(),
  SERPER_API_KEY:    z.string().min(1).optional(),

  // ── Auth (Clerk server-side key) ───────────────────────────────────────
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required for authentication"),

  // ── Observability ─────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
}).refine(
  (e) =>
    !!(e.OPENROUTER_API_KEY || e.ANTHROPIC_API_KEY || e.KIMI_API_KEY || e.OPENAI_API_KEY),
  {
    message:
      "At least one LLM provider key is required (OPENROUTER_API_KEY recommended; or ANTHROPIC_API_KEY / KIMI_API_KEY / OPENAI_API_KEY).",
    path: ["OPENROUTER_API_KEY"],
  },
);

// ─── Validate ────────────────────────────────────────────────────────────────

const result = serverSchema.safeParse(process.env);

if (!result.success) {
  // z.prettifyError is the Zod v4 replacement for the deprecated flatten()
  throw new Error(
    `\n\nInvalid server environment variables:\n${z.prettifyError(result.error)}\n`
  );
}

export const env = result.data;

// ─── Derived helpers ─────────────────────────────────────────────────────────

export const isProd  = env.NODE_ENV === "production";
export const isDev   = env.NODE_ENV === "development";

/** True when at least one Kimi variant is enabled. */
export const kimiEnabled =
  env.USE_KIMI_STRATEGY || env.USE_KIMI_WRITER || env.USE_KIMI_COVER_LETTER;
