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
