import Link from 'next/link';
import { listProducts, searchProducts } from '@/lib/catalog';
import { ProductGrid } from '@/components/site/ProductCard';
import { PageHero } from '@/components/site/PageHero';
import type { Category } from '@/lib/types';

export const metadata = { title: 'Shop' };

const FILTERS: { label: string; value: '' | Category }[] = [
  { label: 'All', value: '' },
  { label: 'Peptides', value: 'peptide' },
  { label: 'Blends', value: 'blend' },
  { label: 'Lab supplies', value: 'supply' },
];

export default async function Shop({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 100);
  const category = FILTERS.some((f) => f.value && f.value === sp.category) ? (sp.category as Category) : undefined;
  const products = q ? searchProducts(q, category, 60) : listProducts({ category });

  const href = (c: string) => `/shop?${new URLSearchParams({ ...(q ? { q } : {}), ...(c ? { category: c } : {}) })}`;

  return (
    <>
      <PageHero title="Shop" />
      <section className="mx-auto max-w-[1140px] px-4 py-8">
        <div className="no-scrollbar mb-5 flex items-center gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <Link
              key={f.label}
              href={href(f.value)}
              className={`shrink-0 rounded-full border px-3 py-1 text-[13px] font-semibold ${(category ?? '') === f.value ? 'border-cyan-soft bg-cyan-soft text-white' : 'border-white/30 text-white/80'}`}
            >
              {f.label}
            </Link>
          ))}
          {q && (
            <Link href={href(category ?? '')} className="ml-auto shrink-0 text-[13px] text-cyan-text">
              “{q}” ✕
            </Link>
          )}
        </div>
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <p className="py-16 text-center text-sm text-white/70">No products match “{q}”. Try another name or ask the assistant.</p>
        )}
      </section>
    </>
  );
}
