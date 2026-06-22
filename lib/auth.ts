/**
 * lib/auth.ts
 *
 * Shared server-side authentication guard. Every protected Server Component
 * and API route should resolve a userId through `requireAuth` (pages) or
 * `requireAuthUserId` (API routes) instead of calling `auth()` directly.
 *
 * Why centralize?
 *  1. Consistent redirect semantics — pages use Clerk's redirectToSignIn()
 *     (preserves returnBackUrl so the user lands back on the page they tried
 *     to reach after signing in), APIs return 401.
 *  2. Single place to harden against transient `auth()` timing mismatches with
 *     the Clerk proxy (e.g. cookie not yet settled after a login redirect).
 *  3. Typed return — `requireAuth` narrows userId to `string` so callers don't
 *     repeat the `userId ? ... : ...` dance that silently swallows null sessions.
 *
 * Ref: https://clerk.com/docs/references/nextjs/auth
 */
import { auth } from "@clerk/nextjs/server";

/**
 * Server Components: returns the userId, or redirects to sign-in via Clerk's
 * redirectToSignIn() if the session is absent. Per Clerk docs, prefer this over
 * redirect("/sign-in") because it preserves the returnBackUrl.
 */
export async function requireAuth(): Promise<string> {
  const { userId, isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated || !userId) return redirectToSignIn();
  return userId;
}

/** API Routes: returns the userId, or throws an HTTP-401 sentinel to be caught. */
export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function requireAuthUserId(): Promise<string> {
  const { userId, isAuthenticated } = await auth();
  if (!isAuthenticated || !userId) throw new UnauthorizedError();
  return userId;
}
