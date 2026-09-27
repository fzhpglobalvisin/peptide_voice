import { coasForProduct, getProduct } from '@/lib/catalog';
import { bad, json } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const product = getProduct(slug);
  if (!product || product.status !== 'active') return bad('Not found', 404);
  return json({ product, coas: coasForProduct(product.id) });
}
