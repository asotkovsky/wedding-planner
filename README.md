# Wedding Planner

Multi-tenant wedding planning app with an AI assistant. Next.js 15, AI SDK, Drizzle, Postgres, Better Auth, shadcn/ui.

## Local setup

```bash
docker compose up -d          # Postgres 17 on :5432
cp .env.example .env.local    # then fill in BETTER_AUTH_SECRET and ANTHROPIC_API_KEY
npm install
npm run db:migrate
npm run dev
```

## Database

- Schema lives in `src/db/schema/`. After changing it: `npm run db:generate` then `npm run db:migrate`.
- `npm run db:studio` opens Drizzle Studio.
- Money is stored as integer cents in the wedding's currency.

## Tenancy

A wedding is the tenant. Users join weddings through `wedding_members` with a role (`owner`, `editor`, `viewer`).
Every page, server action and AI tool must call `requireWeddingAccess(weddingId, minRole)` from `src/lib/access.ts`
and scope queries by `wedding_id`.

## Deployment (Vercel + AWS RDS)

The app runs on Vercel (Fluid compute; the assistant's chat route needs up to 300 s per request,
which rules out Amplify Hosting's 30 s limit). Postgres runs on AWS RDS.

- **Database TLS:** set `DATABASE_SSL=verify`. Connections are encrypted and the server certificate is verified
  against Amazon's RDS root certificates (`src/db/rds-ca.ts`).
- **Migrations:** `vercel-build` runs `scripts/migrate.ts --deploy`, which applies migrations on production
  deployments only. Preview deployments skip it.
- **Region:** `vercel.json` pins functions to `iad1` (us-east-1). Keep it in the same region as the RDS instance.
- **Environment variables (Vercel → Settings → Environment Variables):** `DATABASE_URL`, `DATABASE_SSL=verify`,
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the production URL), `ANTHROPIC_API_KEY`, and optionally
  `ANTHROPIC_WORKSPACE_ID` and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
