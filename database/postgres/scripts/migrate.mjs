#!/usr/bin/env node
// Applies database/postgres/migrations/*.sql in order and records each one in
// `schema_migrations`, so it's safe to run repeatedly.
//
//   pnpm db:migrate            # uses DATABASE_URL (from database/postgres/.env)
//   pnpm db:status             # list applied / pending migrations
//
// For Render, set DATABASE_URL to the database's *External* URL when running
// from your computer (the Internal URL only works from Render services).

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, "migrations");

const args = new Set(process.argv.slice(2));
const statusOnly = args.has("--status");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy database/postgres/.env.example to database/postgres/.env.");
  process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(url);
// Render requires TLS for external connections. Certificates are verified unless
// DB_SSL_NO_VERIFY=1 (only use that if verification fails for a trusted host).
const ssl = isLocal ? false : { rejectUnauthorized: process.env.DB_SSL_NO_VERIFY !== "1" };

const client = new pg.Client({ connectionString: url, ssl });

function redact(u) {
  return u.replace(/\/\/([^:/@]+):[^@]*@/, "//$1:****@");
}

async function main() {
  await client.connect();
  console.log(`Connected to ${redact(url)}`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  const { rows } = await client.query("SELECT version FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.version));

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  const pending = files.filter((f) => !applied.has(f));

  if (statusOnly) {
    for (const f of files) console.log(`${applied.has(f) ? "applied " : "PENDING "} ${f}`);
    return;
  }

  for (const file of pending) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied  ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed (rolled back): ${err.message}`);
    }
  }
  if (pending.length === 0) console.log("Database is up to date.");
}

main()
  .catch((err) => {
    // Connection failures (e.g. ECONNREFUSED) can arrive with an empty message.
    const detail = err.message || err.code || (err.errors?.map((e) => e.message).join("; ") ?? String(err));
    console.error(`Error: ${detail}`);
    if (err.code === "ECONNREFUSED") console.error("Is the database running? Try `pnpm db:up` (needs Docker Desktop).");
    process.exitCode = 1;
  })
  .finally(() => client.end());
