# Self-hosting OpenTrack

OpenTrack is a single Node service (SvelteKit + `adapter-node`) backed by **Postgres or SQLite**.
It ships as a Docker image built from this repo, applies its own database migrations on
startup, and creates the first admin account for you. This guide takes you from zero to a
running, TLS-terminated instance and through the post-install configuration.

- [Requirements](#requirements)
- [Quick start (Docker Compose)](#quick-start-docker-compose)
- [SQLite — the single-container option](#sqlite--the-single-container-option)
- [Environment variables](#environment-variables)
- [First sign-in](#first-sign-in)
- [Reverse proxy & TLS](#reverse-proxy--tls)
- [Persistence & backups](#persistence--backups)
- [Post-install configuration](#post-install-configuration)
- [Updating](#updating)
- [Running more than one instance](#running-more-than-one-instance)
- [Troubleshooting](#troubleshooting)
- [For agents & integrations](#for-agents--integrations)

---

## Requirements

- **Docker** + **Docker Compose** (the supported path), or Node 22+ if you run from source.
- A domain name and a way to terminate TLS (a reverse proxy — examples below). OpenTrack
  speaks plain HTTP on port **3000**; put HTTPS in front of it.
- For the Postgres setup: nothing extra — Compose runs Postgres for you. For SQLite: nothing
  at all beyond a persistent volume.

There is no published image on a registry — you build from this repository (`build: .`).

---

## Quick start (Docker Compose)

The repo ships a `docker-compose.yml` that runs the app **and** a Postgres 16 database.

```bash
git clone <this-repo> opentrack && cd opentrack

# Minimum config: a signing secret, your public URL, and Postgres password.
cat > .env <<EOF
SECRET=$(openssl rand -hex 32)
ORIGIN=https://track.example.com
POSTGRES_PASSWORD=$(openssl rand -hex 16)
ADMIN_PASSWORD=$(openssl rand -base64 12)
EOF

docker compose up -d --build
```

On first boot the app runs migrations, then creates the initial admin. Watch the logs for the
credentials (and to confirm it's serving):

```bash
docker compose logs -f app
# → [migrate] postgres migrations applied
# → OpenTrack — initial admin account created  (Username: admin, Password: …)
# → Listening on http://0.0.0.0:3000
```

Point your reverse proxy at the container's port 3000 (see [below](#reverse-proxy--tls)), then
open `ORIGIN` and sign in.

> **`SECRET` and `ORIGIN` are load-bearing.** `SECRET` signs cookies and anonymous-vote
> tokens — set a long random value and never change it on a live instance (it invalidates
> sessions). `ORIGIN` must exactly match the public URL, including scheme — OAuth redirects and
> webhook/embed URLs are derived from it.

---

## SQLite — the single-container option

SQLite is a first-class backend. No database server, no second container — just a persistent
volume. Ideal for small/solo instances.

```yaml
# docker-compose.sqlite.yml
services:
  app:
    build: .
    restart: unless-stopped
    environment:
      NODE_ENV: production
      ORIGIN: https://track.example.com
      SECRET: ${SECRET:?set SECRET}
      DATABASE_DRIVER: sqlite
      SQLITE_URL: file:/app/data/opentrack.db
      PUBSUB_DRIVER: memory
      UPLOADS_DIR: /app/data/uploads
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}
    ports:
      - '3000:3000'
    volumes:
      - opentrack_data:/app/data     # holds the DB file + uploaded attachments
volumes:
  opentrack_data:
```

```bash
SECRET=$(openssl rand -hex 32) docker compose -f docker-compose.sqlite.yml up -d --build
```

Everything lives in the one `opentrack_data` volume: the `opentrack.db` file and uploaded
attachments. Back that volume up and you've backed up the whole instance.

---

## Environment variables

Configuration is read from the process environment (see `src/lib/server/env.ts`). Everything
else — OAuth providers, the GitHub App, S3, Web Push, MCP — is configured **in the admin UI**,
not here (see [Post-install configuration](#post-install-configuration)).

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `ORIGIN` | **yes** | `http://localhost:5173` | Public URL, e.g. `https://track.example.com`. Used for OAuth redirects, webhooks, embeds. |
| `SECRET` | **yes** | `dev-insecure-secret` | Long random string that signs cookies. Set it; don't rotate it in place. |
| `DATABASE_DRIVER` | yes | `postgres` | `postgres` or `sqlite`. |
| `DATABASE_URL` | if Postgres | — | e.g. `postgres://opentrack:pw@db:5432/opentrack`. |
| `SQLITE_URL` | if SQLite | `file:./data/opentrack.db` | Local file or libSQL URL. |
| `SQLITE_AUTH_TOKEN` | no | — | Auth token for a remote (Turso-style) libSQL database. |
| `PUBSUB_DRIVER` | no | `memory` | Realtime bus. `memory` (single instance) or `postgres` (LISTEN/NOTIFY, multi-instance). `postgres` requires `DATABASE_DRIVER=postgres`. |
| `UPLOADS_DIR` | no | `./data/uploads` | Where attachment bytes are written. Put it on a persistent volume. |
| `ADMIN_USERNAME` | no | `admin` | Username for the auto-created first admin. |
| `ADMIN_PASSWORD` | no | *(random)* | First admin's password. If unset, a random one is generated and printed to the logs. |
| `ADMIN_EMAIL` | no | — | Optional email for the first admin. |
| `PORT` | no | `3000` | Port the server listens on (set in the image). |

> **Note on OAuth / GitHub App env vars:** `.env.example` lists `GITHUB_CLIENT_ID`,
> `GITHUB_APP_ID`, etc. The running app does **not** read these — login providers and the
> GitHub App are configured in the admin UI and stored encrypted in the database. You can
> ignore those entries.

---

## First sign-in

By default there's **no admin in your `.env`**. On first boot with no admin, OpenTrack prints a
one-time **setup code** to the logs and opens a guided first-run flow:

```bash
docker compose logs app
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   OpenTrack — first-run setup
#   1. Open  https://track.example.com/setup
#   2. Enter this one-time setup code:
#
#        A1B2-C3D4
#
#   It creates the first admin account and is single-use.
```

Any page visit is redirected to **`/setup`** until that account exists. There you pick a
username, paste the setup code, and choose your own password — then you're signed in. The code
is consumed on success (and a fresh one is issued if the container restarts before you claim it).

**Non-interactive override.** For automated/unattended installs, set `ADMIN_PASSWORD` (and
optionally `ADMIN_USERNAME`). When present, the admin is created directly on first boot and the
`/setup` flow is skipped.

---

## Reverse proxy & TLS

OpenTrack serves plain HTTP on port 3000. Terminate TLS in front of it and forward to the
container. `ORIGIN` must match the public HTTPS URL.

**Caddy** (automatic HTTPS):

```
track.example.com {
    reverse_proxy localhost:3000
}
```

**Traefik** — add labels to the `app` service (the `docker-compose.yml` has a commented
example):

```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.opentrack.rule=Host(`track.example.com`)
  - traefik.http.routers.opentrack.entrypoints=websecure
  - traefik.http.routers.opentrack.tls.certresolver=le
  - traefik.http.services.opentrack.loadbalancer.server.port=3000
```

**nginx**: a standard `proxy_pass http://127.0.0.1:3000;` with `proxy_set_header Host $host;`
and the usual `X-Forwarded-*` headers. Realtime updates use Server-Sent Events over plain
HTTP — no special WebSocket config needed, but don't buffer the `/…/events` responses.

---

## Persistence & backups

**What must persist:**

- Postgres setup → the `db_data` volume (your database) **and** `app_data` (uploaded
  attachments).
- SQLite setup → the single `opentrack_data` / `app_data` volume (DB file **and** uploads).

**Integrated backups.** Admins get a backup UI at **Admin → Backups**: on-demand snapshots, a
scheduled auto-backup with retention, and safe restore (a staged restore is validated and
swapped in on the next start; the current DB is copied aside first). Backups can be stored
locally or pushed **offsite to S3** (configure the bucket in **Admin → Integrations**;
OpenTrack warns you if that bucket is publicly readable).

Integrated backup/restore is available on **SQLite** deployments. On **Postgres**, use your
provider's tooling (`pg_dump`/`pg_restore`) for full DB backups.

A manual volume snapshot always works too:

```bash
docker run --rm -v opentrack_data:/d:ro -v "$PWD":/out alpine \
  tar czf /out/opentrack-backup.tar.gz -C /d .
```

---

## Post-install configuration

All optional integrations are configured in the **Admin** area (stored in the DB, secrets
encrypted at rest) — no redeploy needed:

- **OAuth login** (Admin → Privacy/Integrations) — enable GitHub / Discord / Modrinth sign-in
  by entering each provider's client id + secret. Redirect URI is `{ORIGIN}/auth/callback/<provider>`.
- **GitHub App — bidirectional sync** (Admin → Integrations) — register a GitHub App
  (Webhook URL `{ORIGIN}/api/webhooks/github`, Issues: Read/Write, subscribe to Issues, Issue
  comment, Pull request, Label, Release). Enter its id/slug/keys, then link repos to projects
  in each project's settings. Tickets ↔ issues stay in sync.
- **Web Push** (Admin → Notifications) — generate a VAPID keypair in the UI to let users
  receive browser notifications for tickets/suggestions they follow.
- **S3 storage** (Admin → Integrations) — offsite backup destination.
- **MCP server & API tokens** (Admin → Integrations / API tokens; workspace owners also under
  workspace settings) — see [For agents & integrations](#for-agents--integrations).

---

## Updating

Migrations are applied automatically every time the container starts, so updating is:

```bash
git pull
docker compose up -d --build      # rebuilds the image, restarts, runs migrations
```

**Back up first** (or take a volume snapshot). Migrations are additive and dual-dialect
(`drizzle/pg` + `drizzle/sqlite`). Never switch `DATABASE_DRIVER` or rename a data volume on a
live instance — that points the app at an empty database while your real data sits orphaned.

---

## Running more than one instance

The default realtime bus is in-process (`PUBSUB_DRIVER=memory`), which only works for a single
app container. To run multiple replicas behind a load balancer:

- Use **Postgres** (`DATABASE_DRIVER=postgres`) and set `PUBSUB_DRIVER=postgres` — realtime
  events then fan out via `LISTEN/NOTIFY`, so every replica sees them.
- Point all replicas at the same `DATABASE_URL` and a **shared** `UPLOADS_DIR` (network/object
  storage), or attachments will only exist on the replica that received the upload.
- The background job worker runs **in-process** inside the server, so any replica can pick up
  jobs — no separate worker deployment required.

SQLite is inherently single-instance.

---

## Troubleshooting

- **Everyone got logged out after a redeploy** → `SECRET` changed (or wasn't pinned). Set a
  fixed `SECRET` in your `.env`.
- **OAuth redirect / "redirect_uri mismatch"** → `ORIGIN` doesn't match the public URL, or the
  provider's callback isn't `{ORIGIN}/auth/callback/<provider>`.
- **Can't find the admin password** → `docker compose logs app | grep -A4 "admin account"`. If
  an admin already existed, no new one is created; reset via the DB or a fresh `ADMIN_*` on an
  empty database.
- **`PUBSUB_DRIVER=postgres` errors on SQLite** → that combination is invalid; use `memory`.
- **Liveness check** → the app has no dedicated health route; a `200` from `GET {ORIGIN}/` and
  `Listening on http://0.0.0.0:3000` in the logs means it's up.

---

## For agents & integrations

OpenTrack is agent-friendly: it exposes a **read/write REST API** and a **Model Context
Protocol (MCP) server**, both authenticated with scoped API keys. A machine-readable summary
lives at **`{ORIGIN}/llms.txt`**.

- **API keys** — create under a workspace's **Settings → API keys**, or **Admin → API tokens**.
  Scopes: `read` (list/read + search) and `write` (create/update tickets, comment). Send as
  `Authorization: Bearer <key>`.
- **REST v1** — `GET /api/v1/projects/{projectId}/tickets`, `/suggestions`, `/releases`
  (read scope; rate-limited).
- **MCP** — `POST /api/mcp` (JSON-RPC / Streamable HTTP). Must be enabled in **Admin →
  Integrations**. Tools: `list_projects`, `list_tickets`, `get_ticket`, `search_tickets`
  (read) and `create_ticket`, `update_ticket`, `add_comment` (write).

See [`/llms.txt`](../static/llms.txt) for the full agent-facing reference.
