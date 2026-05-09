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
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  KIMI_API_KEY:   z.string().min(1).optional(),
  // Override the Kimi base URL when your key is for a non-CN endpoint
  // (e.g. international Kimi Code endpoint). Defaults to api.moonshot.cn/v1.
  KIMI_BASE_URL:  z.string().url().optional(),
  // Override the default model (moonshot-v1-32k) — useful for Kimi Code models
  // that use a different name (e.g. kimi-k2-0711-preview).
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
  CLERK_SECRET_KEY: z.string().min(1).optional(), // required once Clerk is wired

  // ── Observability ─────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

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
