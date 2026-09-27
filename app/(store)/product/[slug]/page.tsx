import Link from 'next/link';
import { notFound } from 'next/navigation';
import { coasForProduct, getProduct } from '@/lib/catalog';
import { priceLabel } from '@/lib/types';
import { VialArt } from '@/components/site/VialArt';
import { AddToCart } from '@/components/site/AddToCart';
import { ShareButtons } from '@/components/site/ShareButtons';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = getProduct((await params).slug);
  if (!p) return { title: 'Product' };
  const description = `${p.name} — ${priceLabel(p)}. Research compound for laboratory use only. Not for human or veterinary use.`;
  // Rich previews when the link is shared on WhatsApp, Facebook, X, Telegram…
  return {
    title: p.name,
    description,
    openGraph: { title: `${p.name} | Ridgeline Fit`, description, type: 'website', images: [p.image_url || '/icons/icon-512.png'] },
    twitter: { card: 'summary', title: `${p.name} | Ridgeline Fit`, description },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = getProduct((await params).slug);
  if (!p || p.status !== 'active') notFound();
  const coas = coasForProduct(p.id);

  return (
    <section className="mx-auto grid max-w-[1140px] gap-8 px-4 py-10 sm:grid-cols-2">
      <div className="grid place-items-center rounded-2xl border border-white/80 bg-black py-8">
        <VialArt product={p} className="h-72 w-52" />
      </div>
      <div>
        <Link href="/shop" className="text-[13px] text-cyan-text">← All products</Link>
        <h1 className="mt-2 font-head text-3xl font-extrabold uppercase tracking-tight text-cyan-text">{p.name}</h1>
        <p className="mt-2 text-lg font-bold text-cyan-price">{priceLabel(p)}</p>
        {p.category !== 'supply' && <p className="mt-1 text-xs text-white/70">Listed purity: {p.purity} · third-party tested</p>}
        <p className="mt-4 text-sm leading-relaxed text-white/85">{p.description}</p>

        <AddToCart product={p} />

        <ShareButtons title={p.name} className="mt-6" />

        <div className="mt-6 rounded-xl border border-white/15 p-4">
          <h2 className="text-xs font-bold uppercase text-cyan-text">Certificates of Analysis</h2>
          {coas.length ? (
            <ul className="mt-2 space-y-1.5 text-xs">
              {coas.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span>
                    {c.label} · batch {c.batch} · {c.test_date}
                  </span>
                  {c.file_url ? (
                    <a href={c.file_url} target="_blank" rel="noreferrer" className="text-cyan-text underline">View</a>
                  ) : (
                    <span className="text-white/40">on request</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-white/60">COA available on request — <Link href="/contact" className="underline">contact us</Link>.</p>
          )}
        </div>

        <p className="mt-6 rounded-lg bg-white/5 p-3 text-[13px] leading-relaxed text-white/60">
          For laboratory research use only. Not for human or veterinary use, not for use in diagnostic procedures. This product has not been evaluated by the U.S. Food and Drug Administration.
        </p>
      </div>
    </section>
  );
}
