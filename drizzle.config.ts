import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { databaseSsl } from "./src/db/ssl";

loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: databaseSsl(),
  },
  strict: true,
});
