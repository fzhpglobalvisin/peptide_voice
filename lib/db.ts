import 'server-only';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA } from './schema';
import { seed } from './seed';

const g = globalThis as unknown as { __rfdb?: Database.Database };

/** Single process-wide connection (WAL mode) — reused across requests and hot reloads. */
export function db(): Database.Database {
  if (g.__rfdb) return g.__rfdb;
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'ridgeline.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new Database(file);
  conn.pragma('journal_mode = WAL');
  conn.pragma('synchronous = NORMAL');
  conn.pragma('foreign_keys = ON');
  conn.pragma('temp_store = MEMORY');
  conn.pragma('cache_size = -16000'); // ~16MB page cache
  conn.pragma('mmap_size = 134217728'); // 128MB
  conn.exec(SCHEMA);
  migrate(conn);
  seed(conn);
  conn.pragma('optimize');
  g.__rfdb = conn;
  return conn;
}

/** Small additive migrations for databases created by earlier versions. */
function migrate(conn: Database.Database) {
  const has = (table: string, col: string) =>
    (conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === col);
  if (!has('orders', 'customer_id')) {
    conn.exec('ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL');
  }
  conn.exec('CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at DESC)');
}

/** Cache prepared statements by SQL text. */
const stmtCache = new Map<string, Database.Statement>();
export function stmt(sql: string): Database.Statement {
  let s = stmtCache.get(sql);
  if (!s) {
    s = db().prepare(sql);
    stmtCache.set(sql, s);
  }
  return s;
}
