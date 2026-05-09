import "server-only";
// Prisma 7 generates the client at client.ts, not index.ts
import { PrismaClient } from "./generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// PrismaNeon uses the pooled DATABASE_URL for all app queries.
// The direct DIRECT_URL is only used by the Prisma CLI (migrations / db push)
// and never imported here.
const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});

// Singleton pattern: reuse the client across hot-reloads in development.
// In production each serverless invocation gets its own module instance.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
