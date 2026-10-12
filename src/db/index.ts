import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { databaseSsl } from "./ssl";

const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

// Reuse one client across hot reloads in dev. In production (Vercel functions) keep the pool
// small and close idle connections quickly: each function instance has its own pool, and a
// small RDS instance only allows ~80 connections in total.
const isProd = process.env.NODE_ENV === "production";
const client =
  globalForDb.pgClient ??
  postgres(process.env.DATABASE_URL!, {
    max: isProd ? 5 : 10,
    idle_timeout: isProd ? 5 : undefined,
    max_lifetime: isProd ? 60 * 10 : undefined,
    ssl: databaseSsl(),
  });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
