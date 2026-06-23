import "server-only";
import { isProd } from "@/lib/config/env";

/**
 * Safe-to-return version of a caught error: the real message in development,
 * a generic string in production. Callers should `console.error` the raw
 * error themselves before using this for the client-facing response — this
 * only prevents Prisma/fs/DB internals from leaking over the wire.
 */
export function safeErrorDetail(err: unknown): string {
  if (isProd) return "An internal error occurred — check server logs.";
  return err instanceof Error ? err.message : String(err);
}
