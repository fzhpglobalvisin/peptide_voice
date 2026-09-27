import 'server-only';
import { exec, q } from './db';
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
  sort_order: number;
}

const COLS = 'id, slug, name, category, price_min, price_max, variants, purity, description, image_url, is_best_seller, status, sort_order';
const NOW = `(floor(extract(epoch from clock_timestamp()) * 1000))::bigint`;

function toProduct({ sort_order: _s, ...r }: ProductRow): Product {
  let variants: Variant[] = [];
  try {
    variants = JSON.parse(r.variants);
  } catch {}
  return { ...r, id: Number(r.id), variants, is_best_seller: r.is_best_seller === 1 };
}

/*
 * Catalog cache. Products and COAs change rarely, so every page reads them from memory instead of
 * making a database round trip. Admin edits clear it at once; other server instances refresh within CACHE_MS.
 */
const CACHE_MS = 60_000;
interface CatalogCache {
  at: number;
  products: Product[]; // all, sorted by name
  best: Product[];
  bySlug: Map<string, Product>;
  byId: Map<number, Product>;
  hay: Map<number, string>;
}
const g = globalThis as unknown as { __rfcat?: CatalogCache; __rfcatLoading?: Promise<CatalogCache>; __rfcoas?: { at: number; rows: (Coa & { product_name: string | null })[] }; __rfcoasLoading?: Promise<(Coa & { product_name: string | null })[]> };

export function clearCatalogCache() {
  g.__rfcat = undefined;
  g.__rfcatLoading = undefined;
  g.__rfcoas = undefined;
  g.__rfcoasLoading = undefined;
}

async function catalog(): Promise<CatalogCache> {
  if (g.__rfcat && Date.now() - g.__rfcat.at < CACHE_MS) return g.__rfcat;
  // one shared load even when many requests arrive together
  g.__rfcatLoading ??= q<ProductRow>(`SELECT ${COLS} FROM products ORDER BY name`)
    .then((rows) => {
      const products = rows.map(toProduct);
      const order = new Map(rows.map((r) => [Number(r.id), Number(r.sort_order)]));
      const c: CatalogCache = {
        at: Date.now(),
        products,
        best: products
          .filter((p) => p.is_best_seller && p.status === 'active')
          .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
          .slice(0, 8),
        bySlug: new Map(products.map((p) => [p.slug, p])),
        byId: new Map(products.map((p) => [p.id, p])),
        hay: new Map(products.map((p) => [p.id, `${p.name} ${p.description} ${p.category} ${p.name.replace(/-/g, ' ')}`.toLowerCase()])),
      };
      g.__rfcat = c;
      return c;
    })
    .finally(() => {
      g.__rfcatLoading = undefined;
    });
  return g.__rfcatLoading;
}

export async function listProducts(opts: { category?: Category; includeRetired?: boolean } = {}): Promise<Product[]> {
  const { products } = await catalog();
  if (opts.category) return products.filter((p) => p.status === 'active' && p.category === opts.category);
  if (opts.includeRetired) return [...products].sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name));
  return products.filter((p) => p.status === 'active');
}

export async function bestSellers(): Promise<Product[]> {
  return (await catalog()).best;
}

export async function getProduct(slug: string): Promise<Product | null> {
  return (await catalog()).bySlug.get(slug) ?? null;
}

export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (!slugs.length) return [];
  const { bySlug } = await catalog();
  return [...new Set(slugs.slice(0, 50))].map((s) => bySlug.get(s)).filter((p): p is Product => !!p);
}

/**
 * Catalog search for the shop and the assistant: every word must match the name, description or
 * category (case-insensitive, partial words). Name matches rank first.
 */
export async function searchProducts(text: string, category?: Category, limit = 12): Promise<Product[]> {
  const terms = text
    .toLowerCase()
    .replace(/[^a-z0-9+\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 6);
  if (!terms.length) return (await listProducts({ category })).slice(0, limit);
  const { products, hay } = await catalog();
  return products
    .filter((p) => p.status === 'active' && (!category || p.category === category))
    .filter((p) => terms.every((t) => hay.get(p.id)!.includes(t)))
    .map((p) => {
      const name = p.name.toLowerCase().replace(/-/g, ' ');
      return { p, rank: terms.filter((t) => name.includes(t)).length };
    })
    .sort((a, b) => b.rank - a.rank || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((x) => x.p);
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
  clearCatalogCache();
  return exec(
    `INSERT INTO products (slug, name, category, price_min, price_max, variants, purity, description, image_url, is_best_seller, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 500)`,
    [p.slug || slugify(p.name), p.name, p.category, p.price_min, p.price_max, JSON.stringify(p.variants), p.purity, p.description, p.image_url, p.is_best_seller ? 1 : 0],
  );
}

export async function updateProduct(id: number, p: ProductInput) {
  clearCatalogCache();
  return exec(
    `UPDATE products SET slug=?, name=?, category=?, price_min=?, price_max=?, variants=?, purity=?, description=?, image_url=?,
       is_best_seller=?, updated_at=${NOW} WHERE id=?`,
    [p.slug || slugify(p.name), p.name, p.category, p.price_min, p.price_max, JSON.stringify(p.variants), p.purity, p.description, p.image_url, p.is_best_seller ? 1 : 0, id],
  );
}

export async function setProductStatus(id: number, status: 'active' | 'retired') {
  clearCatalogCache();
  return exec(`UPDATE products SET status=?, updated_at=${NOW} WHERE id=?`, [status, id]);
}

export async function getProductById(id: number): Promise<Product | null> {
  return (await catalog()).byId.get(id) ?? null;
}

// ─────────────────────────── COAs ───────────────────────────

async function allCoas() {
  if (g.__rfcoas && Date.now() - g.__rfcoas.at < CACHE_MS) return g.__rfcoas.rows;
  g.__rfcoasLoading ??= q<Coa & { product_name: string | null }>(
    `SELECT c.id, c.product_id, p.slug AS product_slug, p.name AS product_name, c.label, c.batch, c.test_date, c.file_size_mb, c.file_url, c.status
     FROM coas c LEFT JOIN products p ON p.id = c.product_id ORDER BY c.label`,
  )
    .then((rows) => {
      g.__rfcoas = { at: Date.now(), rows };
      return rows;
    })
    .finally(() => {
      g.__rfcoasLoading = undefined;
    });
  return g.__rfcoasLoading;
}

const stripName = ({ product_name: _n, ...c }: Coa & { product_name: string | null }): Coa => c;

export async function listCoas(text?: string): Promise<Coa[]> {
  const rows = await allCoas();
  const t = text?.trim().toLowerCase();
  return (t ? rows.filter((c) => c.label.toLowerCase().includes(t) || (c.product_name ?? '').toLowerCase().includes(t)) : rows).map(stripName);
}

export async function coasForProduct(productId: number): Promise<Coa[]> {
  return (await allCoas())
    .filter((c) => c.product_id !== null && Number(c.product_id) === Number(productId))
    .sort((a, b) => String(b.test_date).localeCompare(String(a.test_date)))
    .map(stripName);
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
