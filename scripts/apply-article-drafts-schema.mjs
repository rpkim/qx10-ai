#!/usr/bin/env node
/**
 * Apply db/article-drafts-migration.sql using psql.
 * Requires DATABASE_URL in .env.local (Supabase → Settings → Database → URI).
 *
 *   pnpm db:apply-article-drafts
 *
 * Note: `pnpm db:apply-workspaces` also creates this table (included in
 * workspaces-migration.sql). Use this script only when workspace tables
 * already exist and you just need the article_drafts addition.
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
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (!m) continue;
    const v = m[1].trim().replace(/^['"]|['"]$/g, '');
    if (v) return v;
  }
  return null;
}

const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error(
    'Missing DATABASE_URL.\n' +
      'Add it to .env.local from Supabase Dashboard → Project Settings → Database → Connection string (URI).\n' +
      'Or paste db/article-drafts-migration.sql into the SQL Editor.'
  );
  process.exit(1);
}

const sqlFile = join(root, 'db/article-drafts-migration.sql');
const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlFile], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
