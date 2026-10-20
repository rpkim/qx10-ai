import { Pool, types, type QueryResultRow } from 'pg';

types.setTypeParser(20, (value) => (value == null ? null : Number(value)));

let pool: Pool | null = null;

export function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url || undefined;
}

export function isPostgresConfigured(): boolean {
  return !!getDatabaseUrl();
}

export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = getDatabaseUrl();
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  pool = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 10_000,
    ssl: connectionString.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });
  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
