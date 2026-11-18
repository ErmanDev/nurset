#!/usr/bin/env node
// Creates (or resets the password of) a clinical instructor account.
// Students sign up in the app; instructor accounts are created here.
//
//   pnpm db:create-instructor --email ci@school.edu --name "Angela Reyes, RN" --password "…"
//
// Options: --school "…"  --role "Clinical Instructor"
// Uses DATABASE_URL (from database/postgres/.env), like `pnpm db:migrate`.

import { parseArgs } from "node:util";
import pg from "pg";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    password: { type: "string" },
    school: { type: "string" },
    role: { type: "string", default: "Clinical Instructor" },
  },
});

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
const password = values.password ?? "";
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("pass a valid --email");
if (!name) fail('pass --name, e.g. --name "Angela Reyes, RN"');
if (password.length < 8 || Buffer.byteLength(password) > 72) fail("--password must be 8 to 72 characters");

const url = process.env.DATABASE_URL;
if (!url) fail("DATABASE_URL is not set. Copy database/postgres/.env.example to database/postgres/.env.");
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(url);
const ssl = isLocal ? false : { rejectUnauthorized: process.env.DB_SSL_NO_VERIFY !== "1" };
const client = new pg.Client({ connectionString: url, ssl });

try {
  await client.connect();
  await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  // bcrypt (cost 12) via pgcrypto — the app verifies it with the same algorithm.
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, password_changed_at, full_name, display_name,
                        role, university, account_type)
     VALUES ($1, crypt($2, gen_salt('bf', 12)), now(), $3, split_part($3, ' ', 1), $4, $5, 'clinical_instructor')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, password_changed_at = now(),
           account_type = 'clinical_instructor'
     RETURNING id, (xmax <> 0) AS existed`,
    [email, password, name, values.role, values.school?.trim() || null],
  );
  const { id, existed } = rows[0];
  console.log(existed ? `Updated instructor #${id} (${email}); password reset.` : `Created instructor #${id} (${email}).`);
} catch (err) {
  fail(err.message || err.code || String(err));
} finally {
  await client.end();
}
