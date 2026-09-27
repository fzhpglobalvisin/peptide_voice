import { getProductsBySlugs, listProducts, searchProducts, trackEvents } from '@/lib/catalog';
import { json } from '@/lib/http';
import type { Category } from '@/lib/types';

export const runtime = 'nodejs';

const CATS = ['peptide', 'blend', 'supply'];

/** GET /api/catalog?q=&category=&slugs=a,b&ai=1&sessionId= */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = u.searchParams.get('q')?.slice(0, 100) ?? '';
  const catParam = u.searchParams.get('category') ?? '';
  const category = CATS.includes(catParam) ? (catParam as Category) : undefined;
  const slugs = u.searchParams.get('slugs')?.split(',').filter(Boolean) ?? [];

  const products = slugs.length ? await getProductsBySlugs(slugs) : q ? await searchProducts(q, category) : await listProducts({ category });

  // When the assistant surfaces products, count them as AI recommendations.
  if (u.searchParams.get('ai') === '1') {
    await trackEvents(products.slice(0, 5).map((p) => p.slug), 'ai_recommend', u.searchParams.get('sessionId'));
  }
  return json({ products });
}
