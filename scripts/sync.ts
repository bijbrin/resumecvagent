/**
 * scripts/sync.ts
 *
 * CLI entry point for folder ↔ DB sync. Run via:
 *   npm run sync           # import (bootstrap) + export (refresh sidecars)
 *   npm run sync:import    # import only (folder → DB)
 *   npx tsx scripts/sync.ts export   # export only (DB → folder)
 *
 * Runs in a plain Node context, so it must NOT import `lib/db` (which pulls in
 * `server-only`). It builds its own PrismaClient with the Neon adapter instead.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../lib/generated/prisma/client";
import { exportAll, importAll, resolveSyncUserId } from "../lib/sync/syncAll";

async function main() {
  const mode = (process.argv[2] ?? "all").toLowerCase();

  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL is not set (check .env.local).");
    process.exit(1);
  }

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const userId = await resolveSyncUserId(prisma);
    console.log(`• Syncing as user: ${userId}`);

    if (mode === "import" || mode === "all") {
      const results = await importAll(prisma, userId);
      console.log(`• Imported ${results.length} folder(s):`);
      for (const r of results) console.log(`    ${r.action.padEnd(9)} ${r.slug}`);
    }

    if (mode === "export" || mode === "all") {
      const results = await exportAll(prisma, userId);
      console.log(`• Exported ${results.length} application(s):`);
      for (const r of results) console.log(`    ${r.slug} → ${r.written.join(", ")}`);
    }

    console.log("✓ Sync complete.");
  } catch (err) {
    console.error("✗ Sync failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
