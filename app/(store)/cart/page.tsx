'use client';

import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { VialArt } from '@/components/site/VialArt';
import { FREE_SHIPPING_THRESHOLD, money } from '@/lib/types';

export default function CartPage() {
  const { cart, subtotal, setQty, removeFromCart, openCard } = useApp();
  const toFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <section className="mx-auto max-w-[1140px] px-4 py-10">
      <h1 className="font-head text-3xl font-extrabold uppercase">Your Cart</h1>
      {!cart.length ? (
        <p className="mt-6 text-sm text-white/70">
          Your cart is empty. <Link href="/shop" className="text-cyan-text underline">Browse research compounds</Link> or ask the assistant.
        </p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-white/10 rounded-xl border border-white/20">
            {cart.map((i) => (
              <li key={i.slug + i.variant} className="flex items-center gap-3 p-3">
                <VialArt product={{ name: i.name, image_url: i.image_url, purity: '99%', category: 'peptide' }} className="h-16 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${i.slug}`} className="text-xs font-bold uppercase text-cyan-text">{i.name}</Link>
                  {i.variant && <p className="text-[13px] text-white/60">{i.variant}</p>}
                  <p className="text-[13px] text-cyan-price">{money(i.price)}</p>
                </div>
                <input type="number" min={0} value={i.qty} onChange={(e) => setQty(i.slug, i.variant, Number(e.target.value))} aria-label={`Quantity of ${i.name}`} className="field w-16 text-center" />
                <button onClick={() => removeFromCart(i.slug)} aria-label={`Remove ${i.name}`} className="text-white/50 hover:text-white">✕</button>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl bg-white/5 p-4 text-sm">
            <div className="flex justify-between font-bold"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <p className="mt-1 text-xs text-white/60">{toFree > 0 ? `Add ${money(toFree)} more for free US shipping.` : 'Free US shipping unlocked.'} Use code NEW20 for 20% off your first order.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => openCard('quick_checkout')} className="btn-primary">Checkout</button>
            <button onClick={() => openCard('bulk_quote')} className="btn-outline">Get a quote / WhatsApp</button>
            <button onClick={() => openCard('compare_specs')} className="btn-outline">Compare items</button>
          </div>
        </>
      )}
    </section>
  );
}
