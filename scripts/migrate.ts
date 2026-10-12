// Applies pending migrations from ./drizzle using the app's own connection settings
// (including RDS certificate verification via DATABASE_SSL=verify).
//
//   npm run db:migrate              → migrate the database in DATABASE_URL (.env.local locally)
//   tsx scripts/migrate.ts --deploy → on Vercel: production deployments only, previews skip
//
// Uses drizzle-orm's migrator rather than the drizzle-kit CLI, which fails without an error
// message on TLS connections.
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { databaseSsl } from "../src/db/ssl";

async function main() {
  if (process.argv.includes("--deploy") && process.env.VERCEL_ENV !== "production") {
    console.log(`[migrate] Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
    return;
  }
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

  const sql = postgres(process.env.DATABASE_URL, {
    ssl: databaseSsl(),
    max: 1,
    connect_timeout: 15,
    onnotice: () => {},
  });
  try {
    console.log("[migrate] Applying database migrations…");
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
    console.log("[migrate] Done.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("[migrate] Failed:", e);
  process.exit(1);
});
