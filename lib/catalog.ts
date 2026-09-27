import 'server-only';
import { exec, one, q } from './db';
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
const NOW = `(floor(extract(epoch from clock_timestamp()) * 1000))::bigint`;

function toProduct(r: ProductRow): Product {
  let variants: Variant[] = [];
  try {
    variants = JSON.parse(r.variants);
  } catch {}
  return { ...r, id: Number(r.id), variants, is_best_seller: r.is_best_seller === 1 };
}

export async function listProducts(opts: { category?: Category; includeRetired?: boolean } = {}): Promise<Product[]> {
  const rows = opts.category
    ? await q<ProductRow>(`SELECT ${COLS} FROM products WHERE status='active' AND category=? ORDER BY name`, [opts.category])
    : opts.includeRetired
      ? await q<ProductRow>(`SELECT ${COLS} FROM products ORDER BY status, name`)
      : await q<ProductRow>(`SELECT ${COLS} FROM products WHERE status='active' ORDER BY name`);
  return rows.map(toProduct);
}

export async function bestSellers(): Promise<Product[]> {
  return (await q<ProductRow>(`SELECT ${COLS} FROM products WHERE is_best_seller=1 AND status='active' ORDER BY sort_order LIMIT 8`)).map(toProduct);
}

export async function getProduct(slug: string): Promise<Product | null> {
  const r = await one<ProductRow>(`SELECT ${COLS} FROM products WHERE slug=?`, [slug]);
  return r ? toProduct(r) : null;
}

export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (!slugs.length) return [];
  return (await q<ProductRow>(`SELECT ${COLS} FROM products WHERE slug = ANY(?::text[])`, [slugs.slice(0, 50)])).map(toProduct);
}

/**
 * Catalog search for the shop and the assistant: every word must match the name, description or
 * category (prefix-friendly, case-insensitive). Name matches rank first.
 */
export async function searchProducts(text: string, category?: Category, limit = 12): Promise<Product[]> {
  const terms = text
    .toLowerCase()
    .replace(/[^a-z0-9+\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 6);
  if (!terms.length) return (await listProducts({ category })).slice(0, limit);

  const hay = `lower(name || ' ' || description || ' ' || category || ' ' || replace(name, '-', ' '))`;
  const where = terms.map(() => `${hay} LIKE ?`).join(' AND ');
  const params: unknown[] = terms.map((t) => `%${t.replace(/[%_\\]/g, '')}%`);
  // rank: number of terms found in the name itself
  const rank = terms.map(() => `(CASE WHEN lower(replace(name, '-', ' ')) LIKE ? THEN 1 ELSE 0 END)`).join(' + ');
  const rankParams = terms.map((t) => `%${t.replace(/[%_\\]/g, '')}%`);
  const rows = await q<ProductRow>(
    `SELECT ${COLS} FROM products
     WHERE status='active' AND ${where} ${category ? 'AND category = ?' : ''}
     ORDER BY (${rank}) DESC, name LIMIT ?`,
    [...params, ...(category ? [category] : []), ...rankParams, limit],
  );
  return rows.map(toProduct);
}

/** Compact catalog digest baked into the assistant's system prompt. */
export async function catalogDigest(): Promise<string> {
  return (await listProducts())
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

export async function createProduct(p: ProductInput) {
  return exec(
    `INSERT INTO products (slug, name, category, price_min, price_max, variants, purity, description, image_url, is_best_seller, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 500)`,
    [p.slug || slugify(p.name), p.name, p.category, p.price_min, p.price_max, JSON.stringify(p.variants), p.purity, p.description, p.image_url, p.is_best_seller ? 1 : 0],
  );
}

export async function updateProduct(id: number, p: ProductInput) {
  return exec(
    `UPDATE products SET slug=?, name=?, category=?, price_min=?, price_max=?, variants=?, purity=?, description=?, image_url=?,
       is_best_seller=?, updated_at=${NOW} WHERE id=?`,
    [p.slug || slugify(p.name), p.name, p.category, p.price_min, p.price_max, JSON.stringify(p.variants), p.purity, p.description, p.image_url, p.is_best_seller ? 1 : 0, id],
  );
}

export async function setProductStatus(id: number, status: 'active' | 'retired') {
  return exec(`UPDATE products SET status=?, updated_at=${NOW} WHERE id=?`, [status, id]);
}

export async function getProductById(id: number): Promise<Product | null> {
  const r = await one<ProductRow>(`SELECT ${COLS} FROM products WHERE id=?`, [id]);
  return r ? toProduct(r) : null;
}

// ─────────────────────────── COAs ───────────────────────────

const COA_SQL = `SELECT c.id, c.product_id, p.slug AS product_slug, c.label, c.batch, c.test_date, c.file_size_mb, c.file_url, c.status
  FROM coas c LEFT JOIN products p ON p.id = c.product_id`;

export async function listCoas(text?: string): Promise<Coa[]> {
  if (text && text.trim()) {
    const like = `%${text.trim().toLowerCase().replace(/[%_\\]/g, '')}%`;
    return q<Coa>(`${COA_SQL} WHERE lower(c.label) LIKE ? OR lower(p.name) LIKE ? ORDER BY c.label`, [like, like]);
  }
  return q<Coa>(`${COA_SQL} ORDER BY c.label`);
}

export async function coasForProduct(productId: number): Promise<Coa[]> {
  return q<Coa>(`${COA_SQL} WHERE c.product_id=? ORDER BY c.test_date DESC`, [productId]);
}

// ─────────────────────────── Tracking ───────────────────────────

export type EventType = 'view' | 'ai_recommend' | 'cart_add' | 'quote' | 'order';

export async function trackEvent(slug: string, type: EventType, sessionId?: string | null) {
  await trackEvents([slug], type, sessionId);
}

/** One statement for any number of products. */
export async function trackEvents(slugs: string[], type: EventType, sessionId?: string | null) {
  const list = slugs.slice(0, 50);
  if (!list.length) return;
  await exec(
    `INSERT INTO product_events (product_id, session_id, type)
     SELECT p.id, ?, ? FROM unnest(?::text[]) AS s(slug) JOIN products p ON p.slug = s.slug`,
    [sessionId ?? null, type, list],
  );
}
