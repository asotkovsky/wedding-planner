import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

// Reuse one client across hot reloads in dev. In production (Amplify SSR on Lambda)
// keep the pool small: each concurrent function instance opens its own connections.
const client =
  globalForDb.pgClient ??
  postgres(process.env.DATABASE_URL!, {
    max: process.env.NODE_ENV === "production" ? 3 : 10,
    ssl: process.env.DATABASE_SSL === "true" ? "require" : false,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
