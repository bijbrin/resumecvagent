import "server-only";
import { NextResponse } from "next/server";

/**
 * Defense-in-depth behind Clerk's session auth: browsers attach an `Origin`
 * header on cross-site requests, so a present-but-mismatched Origin means the
 * request didn't come from this app's own frontend. Same-site requests that
 * omit the header (some non-browser clients, server-to-server calls) are not
 * blocked here — Clerk's session check is the primary guard.
 *
 * Takes the plain `Request` type (which `NextRequest` extends) so it works
 * in route handlers that haven't opted into the Next.js-specific request.
 */
function isSameOriginRequest(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  const allowed = new Set([new URL(req.url).origin]);
  if (process.env.NEXT_PUBLIC_APP_URL) allowed.add(process.env.NEXT_PUBLIC_APP_URL);

  return allowed.has(origin);
}

/** Call at the top of state-mutating route handlers (POST/PATCH/DELETE). Returns a 403 response to short-circuit, or null if the request passed. */
export function csrfCheck(req: Request): NextResponse | null {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });
  }
  return null;
}
