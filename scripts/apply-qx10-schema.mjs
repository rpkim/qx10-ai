#!/usr/bin/env node
/**
 * Apply db/qx10-schema.sql using psql.
 * Requires DATABASE_URL in the environment or .env.local.
 *
 *   pnpm db:apply-qx10
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const envPath = join(root, '.env.local');
  if (!existsSync(envPath)) return null;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^DATABASE_URL=(.*)$/);
    if (!match) continue;
    const value = match[1].trim().replace(/^['"]|['"]$/g, '');
    if (value) return value;
  }
  return null;
}

const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error('Missing DATABASE_URL. Add the Neon/Postgres URI to .env.local, then re-run.');
  process.exit(1);
}

const sqlFile = join(root, 'db/qx10-schema.sql');
const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlFile], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
