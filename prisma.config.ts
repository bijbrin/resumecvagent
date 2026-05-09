// Prisma 7 CLI config.
// Next.js uses .env.local for secrets — dotenv's default reads .env,
// so we explicitly point it at .env.local here.
import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL is the non-pooled connection — required for migrations,
    // db push, and introspection (PgBouncer breaks DDL statements).
    url: process.env["DIRECT_URL"],
  },
});
