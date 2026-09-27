import 'server-only';
import { db, stmt } from './db';
import { slugify } from './seed';
import type { Category, Coa, Product, Variant } from './types';

// ─────────────────────────── Catalog ───────────────────────────

interface ProductRow {
  id: number;
  slug: string;
  name: string;
  category: Category;
  price_min: number;
  price_max: number;
  variants: string;
  purity: string;
  description: string;
  image_url: string | null;
  is_best_seller: number;
  status: 'active' | 'retired';
}

const COLS = 'id, slug, name, category, price_min, price_max, variants, purity, description, image_url, is_best_seller, status';

function toProduct(r: ProductRow): Product {
  let variants: Variant[] = [];
  try {
    variants = JSON.parse(r.variants);
  } catch {}
  return { ...r, variants, is_best_seller: r.is_best_seller === 1 };
}

export function listProducts(opts: { category?: Category; includeRetired?: boolean } = {}): Product[] {
  const rows = opts.category
    ? stmt(`SELECT ${COLS} FROM products WHERE status='active' AND category=? ORDER BY name`).all(opts.category)
    : opts.includeRetired
      ? stmt(`SELECT ${COLS} FROM products ORDER BY status, name`).all()
      : stmt(`SELECT ${COLS} FROM products WHERE status='active' ORDER BY name`).all();
  return (rows as ProductRow[]).map(toProduct);
}

export function bestSellers(): Product[] {
  return (stmt(`SELECT ${COLS} FROM products WHERE is_best_seller=1 AND status='active' ORDER BY sort_order LIMIT 8`).all() as ProductRow[]).map(toProduct);
}

export function getProduct(slug: string): Product | null {
  const r = stmt(`SELECT ${COLS} FROM products WHERE slug=?`).get(slug) as ProductRow | undefined;
  return r ? toProduct(r) : null;
}

export function getProductsBySlugs(slugs: string[]): Product[] {
  if (!slugs.length) return [];
  const clean = slugs.slice(0, 10);
  const rows = db()
    .prepare(`SELECT ${COLS} FROM products WHERE slug IN (${clean.map(() => '?').join(',')})`)
    .all(...clean) as ProductRow[];
  return rows.map(toProduct);
}

/** FTS5 prefix search with a LIKE fallback. Used by the shop and the assistant's catalog RAG. */
export function searchProducts(q: string, category?: Category, limit = 12): Product[] {
  const terms = q
    .toLowerCase()
    .replace(/[^a-z0-9+\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 6);
  if (!terms.length) return listProducts({ category }).slice(0, limit);

  const match = terms.map((t) => `"${t.replace(/"/g, '')}"*`).join(' ');
  let rows = db()
    .prepare(
      `SELECT ${COLS.split(', ').map((c) => 'p.' + c).join(', ')}
       FROM products_fts f JOIN products p ON p.id = f.rowid
       WHERE products_fts MATCH ? AND p.status='active' ${category ? 'AND p.category = ?' : ''}
       ORDER BY bm25(products_fts, 10.0, 1.0, 2.0) LIMIT ?`,
    )
    .all(...(category ? [match, category, limit] : [match, limit])) as ProductRow[];

  if (!rows.length) {
    const like = `%${q.trim().replace(/[%_]/g, '')}%`;
    rows = db()
      .prepare(
        `SELECT ${COLS} FROM products WHERE status='active' AND name LIKE ? ${category ? 'AND category = ?' : ''} ORDER BY name LIMIT ?`,
      )
      .all(...(category ? [like, category, limit] : [like, limit])) as ProductRow[];
  }
  return rows.map(toProduct);
}

/** Compact catalog digest baked into the assistant's system prompt. */
export function catalogDigest(): string {
  return listProducts()
    .map((p) => `${p.name} [${p.slug}] ${p.category} $${p.price_min}${p.price_max !== p.price_min ? '-' + p.price_max : ''}`)
    .join('\n');
}

export interface ProductInput {
  name: string;
  slug?: string;
  category: Category;
  price_min: number;
  price_max: number;
  variants: Variant[];
  purity: string;
  description: string;
  image_url: string | null;
  is_best_seller: boolean;
}

export function createProduct(p: ProductInput) {
  return stmt(
    `INSERT INTO products (slug, name, category, price_min, price_max, variants, purity, description, image_url, is_best_seller, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 500)`,
  ).run(
    p.slug || slugify(p.name),
    p.name,
    p.category,
    p.price_min,
    p.price_max,
    JSON.stringify(p.variants),
    p.purity,
    p.description,
    p.image_url,
    p.is_best_seller ? 1 : 0,
  );
}

export function updateProduct(id: number, p: ProductInput) {
  return stmt(
    `UPDATE products SET slug=?, name=?, category=?, price_min=?, price_max=?, variants=?, purity=?, description=?, image_url=?,
       is_best_seller=?, updated_at=(strftime('%s','now')*1000) WHERE id=?`,
  ).run(
    p.slug || slugify(p.name),
    p.name,
    p.category,
    p.price_min,
    p.price_max,
    JSON.stringify(p.variants),
    p.purity,
    p.description,
    p.image_url,
    p.is_best_seller ? 1 : 0,
    id,
  );
}

export function setProductStatus(id: number, status: 'active' | 'retired') {
  return stmt(`UPDATE products SET status=?, updated_at=(strftime('%s','now')*1000) WHERE id=?`).run(status, id);
}

export function getProductById(id: number): Product | null {
  const r = stmt(`SELECT ${COLS} FROM products WHERE id=?`).get(id) as ProductRow | undefined;
  return r ? toProduct(r) : null;
}

// ─────────────────────────── COAs ───────────────────────────

const COA_SQL = `SELECT c.id, c.product_id, p.slug AS product_slug, c.label, c.batch, c.test_date, c.file_size_mb, c.file_url, c.status
  FROM coas c LEFT JOIN products p ON p.id = c.product_id`;

export function listCoas(q?: string): Coa[] {
  if (q && q.trim()) {
    const like = `%${q.trim().replace(/[%_]/g, '')}%`;
    return stmt(`${COA_SQL} WHERE c.label LIKE ? OR p.name LIKE ? ORDER BY c.label`).all(like, like) as Coa[];
  }
  return stmt(`${COA_SQL} ORDER BY c.label`).all() as Coa[];
}

export function coasForProduct(productId: number): Coa[] {
  return stmt(`${COA_SQL} WHERE c.product_id=? ORDER BY c.test_date DESC`).all(productId) as Coa[];
}

// ─────────────────────────── Tracking ───────────────────────────

export type EventType = 'view' | 'ai_recommend' | 'cart_add' | 'quote' | 'order';

export function trackEvent(slug: string, type: EventType, sessionId?: string | null) {
  stmt(
    `INSERT INTO product_events (product_id, session_id, type) SELECT id, ?, ? FROM products WHERE slug = ?`,
  ).run(sessionId ?? null, type, slug);
}

export function trackEvents(slugs: string[], type: EventType, sessionId?: string | null) {
  const tx = db().transaction((list: string[]) => list.forEach((s) => trackEvent(s, type, sessionId)));
  tx(slugs.slice(0, 50));
}
