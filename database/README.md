# NurSet database (PostgreSQL)

```
database/postgres/
  migrations/           0001_init.sql … — the schema (multi-user)
  scripts/migrate.mjs   migration runner (tracks schema_migrations)
  scripts/create-instructor.mjs   creates a clinical instructor account
  docker-compose.yml    local PostgreSQL 16 on port 5433
  .env.example          DATABASE_URL template (copy to .env, git-ignored)
```

Only the NurSet server (`server/`) connects to PostgreSQL; the desktop app
talks to the server. The server reads `DATABASE_URL` (falling back to the local
Docker database `postgres://nurset:nurset_dev@localhost:5433/nurset`) and
applies pending migrations every time it starts. Uploaded files are stored in
the `stored_files` table.

## Accounts

- **Nursing students** sign up on the app's Register screen.
- **Clinical instructors** are created by an administrator:

  ```sh
  pnpm db:create-instructor --email ci@school.edu --name "Angela Reyes, RN" --password "…"
  ```

  Running it again for the same email resets that account's password.

Passwords are stored as bcrypt hashes. Each sign-in creates a row in `sessions`
(only the token's SHA-256 is stored); "Keep me signed in" saves the token in the
app's config folder (`session.json`) so the next launch restores it. Settings ›
Privacy & Security lists sessions and can sign other devices out.

## Local development

```sh
pnpm app          # starts the database (Docker), applies migrations, runs the app
```

Or step by step:

```sh
pnpm db:up        # start PostgreSQL 16 in Docker (Docker Desktop must be running)
pnpm db:migrate   # apply pending migrations
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

The Blueprint in `render.yaml` creates the database and the server together
(see the root README). The server applies the migrations on its first start.
To create instructor accounts, copy the database's **External Database URL**
into `database/postgres/.env` as `DATABASE_URL`, then run
`pnpm db:create-instructor …` (TLS is used automatically for non-local hosts).

## Changing the schema

Add a new numbered file, e.g. `migrations/0009_add_x.sql`, and list it in
`server/src/migrate.rs` (a test fails if you forget). Restart the server, or
run `pnpm db:migrate`. Never edit a migration that has already been applied.
