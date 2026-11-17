# NurSet database (PostgreSQL)

```
database/postgres/
  migrations/           0001_init.sql … — the schema (multi-user)
  seed/dev_seed.sql     sample data for LOCAL development only
  scripts/migrate.mjs   migration runner (tracks schema_migrations)
  docker-compose.yml    local PostgreSQL 16 on port 5433
  .env.example          DATABASE_URL template (copy to .env, git-ignored)
```

The desktop app connects to PostgreSQL through its Rust backend (SQLx). It
reads `DATABASE_URL`, falling back to the local Docker database
`postgres://nurset:nurset_dev@localhost:5433/nurset`.

Until sign-in exists, the app acts as the **first user** in the `users` table
(the dev seed's `demo@nurset.local`), creating `student@nurset.local` if the
table is empty.

## Local development

```sh
pnpm app          # starts the database (Docker), applies migrations, runs the app
```

Or step by step:

```sh
pnpm db:up        # start PostgreSQL 16 in Docker (Docker Desktop must be running)
pnpm db:migrate   # apply pending migrations
pnpm db:seed      # migrate + load sample data (demo@nurset.local)
pnpm db:status    # list applied / pending migrations
pnpm db:down      # stop the container (data is kept in a Docker volume)
```

Backend tests that run every command against the live database:

```sh
cd src-tauri && cargo test -- --include-ignored
```

## Schema notes

- Every personal table has `user_id`; links between tables use composite
  foreign keys on `(user_id, id)`, so a row can never point at another user's data.
- Real types: `DATE`, `TIME`, `TIMESTAMPTZ`, `BOOLEAN`, `TEXT[]`, `JSONB`.
  The backend renders dates/times as text in the machine's local time zone.
- Files: `storage_key` holds where an upload lives (currently a path in the
  NurSet app-data folder on this computer).
- Premium is prototype-only: `subscriptions` + `receipts`, no payment provider.

## Deploying to Render

1. Render Dashboard → **New → PostgreSQL** (PostgreSQL 16, same region you'll use for the API).
2. Copy the **External Database URL** into `database/postgres/.env` as `DATABASE_URL`.
3. `pnpm db:migrate` — creates the schema (TLS is used automatically for non-local hosts).
4. Do **not** run `db:seed` against Render; it refuses unless you pass `--force`.

> **Important:** don't ship the desktop app pointed at Render PostgreSQL —
> the database password would be inside the app. Before release, add an API
> server (a Render **Web Service**) that owns the database connection (via the
> **Internal Database URL**) and handles sign-in, and have the app call it.
> The SQL in `src-tauri/src/commands/` can move into that server largely as-is.

## Changing the schema

Add a new numbered file, e.g. `migrations/0002_add_x.sql`, then `pnpm db:migrate`.
Never edit a migration that has already been applied.
