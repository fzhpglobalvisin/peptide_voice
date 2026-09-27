import Link from 'next/link';
import type { Product } from '@/lib/types';
import { priceLabel } from '@/lib/types';
import { VialArt } from './VialArt';

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link
      href={`/product/${p.slug}`}
      className="group flex flex-col items-center rounded-2xl border border-white/90 bg-black px-3 pb-6 pt-6 text-center transition hover:border-cyan-soft hover:shadow-[0_0_24px_rgba(61,184,217,0.25)]"
    >
      <VialArt product={p} className="h-44 w-32 transition group-hover:scale-105 sm:h-56 sm:w-40" />
      <h3 className="mt-5 text-sm font-bold uppercase leading-snug text-cyan-text sm:text-base">{p.name}</h3>
      <p className="mt-1.5 text-sm font-bold text-cyan-price sm:text-base">{priceLabel(p)}</p>
      <span className="mt-5 rounded-full bg-cyan-soft px-5 py-2 text-sm font-semibold text-white group-hover:bg-cyan-brand">
        {p.variants.length > 1 ? 'Select options' : 'View product'}
      </span>
    </Link>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>;
}
