/**
 * Client-safe environment variables.
 *
 * Only NEXT_PUBLIC_* vars live here — Next.js inlines them into the
 * browser bundle at build time. Safe to import in Client Components.
 */

import { z } from "zod";

const clientSchema = z.object({
  // ── Clerk (publishable key is intentionally public) ────────────────────
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL:     z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL:     z.string().default("/sign-up"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default("/optimizer"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default("/optimizer"),

  // ── App metadata ──────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.string().optional(),
});

const result = clientSchema.safeParse({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:   process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CLERK_SIGN_IN_URL:       process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
  NEXT_PUBLIC_CLERK_SIGN_UP_URL:       process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
  NEXT_PUBLIC_APP_URL:                 process.env.NEXT_PUBLIC_APP_URL,
});

if (!result.success) {
  throw new Error(
    `\n\nInvalid client environment variables:\n${z.prettifyError(result.error)}\n`
  );
}

export const clientEnv = result.data;
