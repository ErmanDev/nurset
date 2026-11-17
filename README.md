# NurSet

Desktop companion for nursing students: duty schedule, requirements, tasks,
duty checklist, CI notes, and progress.

**Stack:** Tauri 2 (Rust) · React 19 + TypeScript + Vite · PostgreSQL (SQLx) · pnpm

## Run

```sh
pnpm install
pnpm app          # starts PostgreSQL (Docker), migrates, then Vite + the desktop window
pnpm app:build    # release build + installer in src-tauri/target/release/bundle
```

Requires Docker Desktop: `pnpm app` starts the local PostgreSQL database
(`pnpm db:up`), applies migrations, then launches the app. Load sample data
once with `pnpm db:seed`. See `database/README.md`.

## Structure

```
database/postgres/            PostgreSQL schema, seed, migration runner — see database/README.md
src/                          React frontend
  App.tsx                     routes
  navigation.ts               sidebar items (path, label, icon)
  layouts/AppLayout.tsx       sidebar + top bar + page outlet
  components/                 Sidebar, TopBar, Logo, PagePlaceholder
  pages/
    Dashboard/                Home screen (done) + components/
    DutySchedule/ Requirements/ Tasks/ DutyChecklist/
    AiStudy/ CiNotes/ Progress/ QuickLinks/ Settings/   placeholders
  lib/api.ts                  typed wrappers for every Rust command
  lib/types.ts                TS types mirroring src-tauri/src/models.rs
  lib/format.ts               date/time/duration helpers
  hooks/useAsync.ts           load data + reload
  styles/global.css           design tokens and shared classes

src-tauri/                    Rust backend
  tauri.conf.json             window config (1280x820, resizable, not fullscreen)
  src/lib.rs                  app setup + command registration
  src/db.rs                   PostgreSQL pool (SQLx) + current user
  src/models.rs               row structs (+ SELECT columns and row mappers)
  src/commands/               one module per page
```

## Adding a feature

1. **Schema change:** add `database/postgres/migrations/0NNN_*.sql` and run
   `pnpm db:migrate`. Never edit an applied migration. See `database/README.md`.
2. **Command:** add a `#[tauri::command]` fn in `src-tauri/src/commands/<page>.rs`
   and register it in `generate_handler![]` in `src-tauri/src/lib.rs`.
3. **Frontend:** add the type to `src/lib/types.ts`, a wrapper to `src/lib/api.ts`,
   and replace the page's `PagePlaceholder` with real UI.
