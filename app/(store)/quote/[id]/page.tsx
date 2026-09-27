/* eslint-disable @next/next/no-img-element */
import { notFound } from 'next/navigation';
import { getQuote } from '@/lib/store';
import { getProductsBySlugs, listCoas } from '@/lib/catalog';
import { money, priceLabel } from '@/lib/types';
import { VialArt } from '@/components/site/VialArt';
import { ShareButtons } from '@/components/site/ShareButtons';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const q = getQuote((await params).id);
  return {
    title: q ? `Research Quote ${q.id}` : 'Quote',
    robots: { index: false },
    openGraph: q ? { title: `Ridgeline Fit research quote — ${money(q.subtotal)}`, description: q.items.map((i) => i.name).join(', ') } : undefined,
  };
}

/** Image quote brochure linked from WhatsApp. */
export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const q = getQuote((await params).id);
  if (!q) notFound();
  const products = new Map(getProductsBySlugs(q.items.map((i) => i.slug)).map((p) => [p.slug, p]));
  const coas = listCoas();

  return (
    <section className="mx-auto max-w-[1000px] px-4 py-10 print:text-black">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] uppercase tracking-widest text-cyan-text">Research quote</p>
          <h1 className="font-head text-3xl font-extrabold">#{q.id}</h1>
          <p className="mt-1 text-xs text-white/60">
            {q.lead_name ? `Prepared for ${q.lead_name} · ` : ''}
            {new Date(q.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })} · prices valid 14 days
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {q.items.map((i) => {
          const p = products.get(i.slug);
          const itemCoas = coas.filter((c) => c.product_slug === i.slug).slice(0, 3);
          return (
            <article key={i.slug + i.variant} className="flex gap-3 rounded-xl border border-white/20 bg-[#050b14] p-3">
              {p ? <VialArt product={p} className="h-28 w-20 shrink-0" /> : null}
              <div className="min-w-0 text-xs">
                <h2 className="font-bold uppercase text-cyan-text">{i.name}</h2>
                {i.variant && <p className="text-white/60">Option: {i.variant}</p>}
                <p className="mt-1">
                  {i.qty} × {money(i.price)} = <b>{money(i.price * i.qty)}</b>
                </p>
                {p && <p className="text-white/60">List: {priceLabel(p)} · {p.category === 'supply' ? 'Lab supply' : `Purity ${p.purity}`}</p>}
                {itemCoas.length > 0 && (
                  <p className="mt-1 text-white/60">
                    COA: {itemCoas.map((c) => `${c.label} (${c.test_date})`).join(', ')}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl bg-white/5 p-4 text-sm">
        <div className="flex justify-between font-bold">
          <span>Subtotal</span>
          <span>{money(q.subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-white/60">{q.subtotal >= 300 ? 'Free US shipping applies.' : 'Free US shipping on orders over $300.'} First order? Code NEW20 takes 20% off.</p>
      </div>

      <ShareButtons title={`Research quote #${q.id}`} className="mt-6" />

      <p className="mt-6 text-[13px] leading-relaxed text-white/50">
        All products are sold for in vitro and laboratory research use only. Not for human or veterinary use, not for diagnostic procedures, and not evaluated by the U.S. Food and Drug Administration. Orders are confirmed with the Ridgeline Fit team on WhatsApp.
      </p>
    </section>
  );
}
