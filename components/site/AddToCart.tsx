'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { money, type Product } from '@/lib/types';

export function AddToCart({ product }: { product: Product }) {
  const { addToCart, track, openCard } = useApp();
  const [variant, setVariant] = useState(product.variants[0]?.label ?? '');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const v = product.variants.find((x) => x.label === variant);
  const price = v?.price ?? product.price_min;

  useEffect(() => {
    track([product.slug], 'view');
  }, [product.slug, track]);

  return (
    <div className="mt-5 space-y-3">
      {product.variants.length > 0 && (
        <label className="block text-xs font-semibold">
          Option
          <select value={variant} onChange={(e) => setVariant(e.target.value)} className="field mt-1">
            {product.variants.map((x) => (
              <option key={x.label} value={x.label} className="bg-black">
                {x.label} — {money(x.price)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex items-center gap-2">
        <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} aria-label="Quantity" className="field w-20 text-center" />
        <button
          className="btn-primary flex-1"
          onClick={() => {
            addToCart({ slug: product.slug, name: product.name, variant: v?.label ?? null, price, qty, image_url: product.image_url });
            setAdded(true);
            setTimeout(() => setAdded(false), 1800);
          }}
        >
          {added ? 'Added ✓' : `Add to cart · ${money(price * qty)}`}
        </button>
      </div>
      {!product.variants.length && product.price_min !== product.price_max && (
        <p className="text-[13px] text-white/60">Several sizes available — the starting price is added; request a quote for other sizes.</p>
      )}
      <div className="flex gap-2">
        <button onClick={() => openCard('compare_specs', { slugs: [product.slug] })} className="btn-outline">Compare</button>
        <button onClick={() => openCard('bulk_quote', { fields: { quantity_notes: `${product.name}: ` } })} className="btn-outline">Bulk quote</button>
      </div>
    </div>
  );
}
