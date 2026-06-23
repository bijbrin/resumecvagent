import "server-only";
// Prisma 7 generates the client at client.ts, not index.ts
import { PrismaClient } from "./generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { env } from "@/lib/config/env";

// PrismaNeon uses the pooled DATABASE_URL for all app queries.
// The direct DIRECT_URL is only used by the Prisma CLI (migrations / db push)
// and never imported here. `env` is already validated at import time (throws
// a clear error if DATABASE_URL is missing/malformed) — no `!` assertion needed.
const adapter = new PrismaNeon({
  connectionString: env.DATABASE_URL,
});

// Singleton pattern: reuse the client across hot-reloads in development.
// In production each serverless invocation gets its own module instance.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
