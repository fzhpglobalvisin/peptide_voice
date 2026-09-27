'use client';

import type { CartItem, Coa, Product } from './types';

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || `Request failed (${r.status})`);
  return d as T;
}

const post = <T,>(url: string, body: unknown) => j<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const api = {
  search: (q: string, opts: { category?: string; ai?: boolean; sessionId?: string | null } = {}) =>
    j<{ products: Product[] }>(
      `/api/catalog?${new URLSearchParams({ q, ...(opts.category ? { category: opts.category } : {}), ...(opts.ai ? { ai: '1', sessionId: opts.sessionId ?? '' } : {}) })}`,
    ).then((d) => d.products),
  bySlugs: (slugs: string[]) => j<{ products: Product[] }>(`/api/catalog?slugs=${encodeURIComponent(slugs.join(','))}`).then((d) => d.products),
  product: (slug: string) => j<{ product: Product; coas: Coa[] }>(`/api/products/${encodeURIComponent(slug)}`),
  coas: (q = '') => j<{ coas: Coa[] }>(`/api/coas?q=${encodeURIComponent(q)}`).then((d) => d.coas),
  lead: (body: Record<string, unknown>) => post<{ leadId: number }>('/api/leads', body),
  quote: (items: CartItem[], sessionId: string | null, leadId: number | null) =>
    post<{ quoteId: string; subtotal: number; brochureUrl: string; waUrl: string; sentViaCloud: boolean }>('/api/quotes', { items, sessionId, leadId }),
  order: (body: Record<string, unknown>) =>
    post<{ orderId: number; subtotal: number; discount: number; total: number; brochureUrl: string; waUrl: string; sentViaCloud: boolean }>('/api/orders', body),
  research: (body: Record<string, unknown>) => post<{ ok: true }>('/api/research', body),
  compliance: (body: Record<string, unknown>) => post<{ ok: true }>('/api/compliance', body),
};

export function toCartItem(p: Product, variant?: string | null, qty = 1): CartItem {
  const v = p.variants.find((x) => x.label.toLowerCase() === (variant ?? '').toLowerCase());
  return { slug: p.slug, name: p.name, variant: v?.label ?? null, price: v?.price ?? p.price_min, qty, image_url: p.image_url };
}
