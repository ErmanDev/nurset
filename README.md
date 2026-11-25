# NurSet

Desktop companion for nursing students and clinical instructors: duty
schedule, requirements and document reviews, tasks, duty checklist, CI notes,
attendance and evaluations, progress, and AI Study.

**Stack:** Tauri 2 desktop app (React 19 + TypeScript + Vite) · Rust API server
(axum + SQLx) · PostgreSQL · Google Gemini · pnpm

## How it fits together

```
NurSet desktop app (installed)  ──HTTPS──▶  NurSet server (Render)  ──▶  PostgreSQL (Render)
  src/  + src-tauri/                          server/                     database/postgres/migrations
  no secrets, no database                     accounts, data, files,      applied by the server on start
                                              Gemini key
```

- The app calls `POST /api/rpc/<command>` with a bearer token from sign-in
  (`src/lib/client.ts`). Uploads go to `/api/upload/*`; "open" and "export"
  return one-time `/files/<ticket>` links opened in the browser.
- The server applies database migrations on startup and stores uploaded files
  in PostgreSQL, so it needs no disk.

## Run locally

Requires Docker Desktop and Rust.

```sh
pnpm install
cp server/.env.example server/.env   # add GEMINI_API_KEY for AI Study (optional)
pnpm app                             # database (Docker) + API server + desktop window
```

`pnpm app` runs `pnpm db:up`, then the server (`pnpm server`) and `tauri dev`
side by side. On Register, people choose Nursing Student or Clinical Instructor.
An instructor invites students to a group by email or student ID; the student
must accept before the instructor can see any of their records.

Tests (from `server/`, database running):

```sh
cargo test -- --include-ignored --skip gemini   # everything except live AI calls
cargo test gemini -- --ignored --nocapture      # live Gemini checks (uses your key)
```

## Deploy

### 1. Server and database on Render

1. Put the repository on GitHub (Render can't pull from Codeberg). A private repo is fine.
2. Render dashboard → **New → Blueprint** → choose the repo. It reads `render.yaml`
   and creates `nurset-api` (Docker web service) and `nurset-db` (PostgreSQL),
   both in Singapore.
3. Enter `GEMINI_API_KEY` when Render asks (leave empty to run without AI).
4. Wait for the deploy, then open `https://<service>.onrender.com/health`.
   It should show `{"ok":true,...}`. The schema is created automatically.
5. Optional: instructors can register in the app, or you can create them. Copy the database's
   **External Database URL** into `database/postgres/.env` as `DATABASE_URL`, then:

   ```sh
   pnpm db:create-instructor --email ci@school.edu --name "Angela Reyes, RN" --password "…"
   ```

Plans: `render.yaml` uses the free plans. A free web service sleeps after
15 minutes idle (the next request takes about a minute). **A free database
expires 30 days after creation and is deleted 14 days later**, so switch
`nurset-db` to a paid plan before real use.

### 2. Desktop installer

Point the app at the live server and build:

```sh
echo VITE_API_URL=https://<service>.onrender.com > .env.production
pnpm app:build
```

The installer is in `src-tauri/target/release/bundle/` (`.msi` and `-setup.exe`).
It contains no secrets: everything sensitive stays on the server.

### 3. Web app on Vercel

The same frontend runs in the browser (`src/lib/platform.ts` detects it: no
window buttons, files open in a new tab, exports download in place).

1. Vercel dashboard → **Add New → Project** → import `ErmanDev/nurset`.
2. Vercel reads `vercel.json` (Vite, `pnpm build`, output `dist`). The server
   address comes from `.env.production` (`VITE_API_URL`); you can also set it
   under the project's Environment Variables.
3. Deploy. Every push to `main` redeploys the site.

## Structure

```
server/                       Rust API server (Render)
  src/main.rs                 HTTP routes, auth, errors, downloads
  src/dispatch.rs             command name -> function (generated from signatures)
  src/commands/               one module per feature (same logic the app used locally)
  src/migrate.rs              applies database/postgres/migrations on startup
  src/files.rs                uploaded files (in PostgreSQL) + one-time download links
  src/ai.rs                   Google Gemini: chat, Quizlab, quiz feedback
  Dockerfile, .env.example
render.yaml                   Render Blueprint (server + database)
database/postgres/            schema migrations, local Docker database, scripts
src/                          React frontend
  lib/client.ts               HTTP client: server URL, token storage, errors
  lib/api.ts, lib/instructor.ts   typed wrappers for every command
  pages/                      student pages, Instructor/, Settings/, Auth/, Legal/
src-tauri/                    desktop shell: window, opening links, device name
docs/                         user guide (PDF + generator)
```

## Adding a feature

1. **Schema:** add `database/postgres/migrations/0NNN_*.sql` and list it in
   `server/src/migrate.rs`. Never edit an applied migration.
2. **Command:** add a `pub async fn name(db: &Db, ...)` in
   `server/src/commands/<module>.rs` and a matching line in
   `server/src/dispatch.rs` (arguments use the app's camelCase names), e.g.
   `"add_task" => out(commands::tasks::add_task(db, arg(&mut a, "input")?).await),`
3. **Frontend:** add types to `src/lib/types.ts` and a wrapper to `src/lib/api.ts`.
