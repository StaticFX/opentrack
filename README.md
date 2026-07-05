# OpenTrack

An open, public-by-default issue tracker. Workspaces → projects → boards, fully
customizable kanban, detailed tickets, a public suggestion panel, releases, and
**bidirectional GitHub sync**. Built to be self-hosted.

- **Stack:** SvelteKit (Svelte 5) · Drizzle ORM · TypeScript · Tailwind v4
- **Database:** Postgres **or** SQLite (both first-class — pick with `DATABASE_DRIVER`)
- **Realtime:** SSE, backed by an in-process bus or Postgres `LISTEN/NOTIFY`
- **Auth:** OAuth (GitHub/Discord/Modrinth) + admin email/password + invite codes

> Status: **Milestone 1 complete** — scaffold, dual-dialect schema, migrations,
> job queue, realtime plumbing, and Docker. See `.claude/plans` for the roadmap.

## Quick start (development)

```bash
cp .env.example .env          # then edit SECRET etc.
npm install

# ── Option A: SQLite (zero external services) ──
echo "DATABASE_DRIVER=sqlite" >> .env
npm run db:migrate            # applies drizzle/sqlite migrations to ./data/opentrack.db
npm run dev

# ── Option B: Postgres ──
# set DATABASE_DRIVER=postgres and DATABASE_URL in .env, then:
npm run db:migrate
npm run dev
```

Open http://localhost:5173.

## Database drivers

The schema is defined once (`src/lib/server/db/define.ts`) against an injected
column kit and compiled for both dialects (`kit.pg.ts` / `kit.sqlite.ts`). IDs
are application-generated UUIDs and columns use portable types, so the same
service code runs on either backend.

| Task | Command |
| --- | --- |
| Generate migrations (Postgres) | `npm run db:generate` |
| Generate migrations (SQLite) | `DATABASE_DRIVER=sqlite npm run db:generate` |
| Apply migrations | `npm run db:migrate` (respects `DATABASE_DRIVER`) |
| Runtime smoke test | `DATABASE_DRIVER=sqlite npm run smoke` |

Migrations live in `drizzle/pg` and `drizzle/sqlite`.

## Background jobs & realtime

- **Jobs:** a portable `jobs` table + polling worker (`src/lib/server/jobs`).
  Runs in-process by default; set `OT_DISABLE_INPROCESS_WORKER=1` and run
  `npm run worker` to scale it out.
- **Realtime:** `PUBSUB_DRIVER=memory` (single instance) or `postgres`
  (`LISTEN/NOTIFY`, multi-instance; requires `DATABASE_DRIVER=postgres`).

## Production (Docker)

```bash
docker compose up -d --build   # app + Postgres; migrations run on boot
```

Configure via environment (see `.env.example`). Behind a reverse proxy, set
`ORIGIN` to the public URL and add Traefik labels to the `app` service.

## Configuration

All configuration is via environment variables — see `.env.example` for the full
list (core, database, realtime, OAuth providers, GitHub App, bootstrap admin).
