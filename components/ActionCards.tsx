'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from './AppProvider';
import { api } from '@/lib/client';
import { DISCOUNT_CODES, FREE_SHIPPING_THRESHOLD, money, priceLabel, type Coa, type Product } from '@/lib/types';
import { VialArt } from './site/VialArt';

const TITLES = {
  compare_specs: 'Compare Specifications',
  bulk_quote: 'Bulk / Lab Quote',
  quick_checkout: 'Quick Checkout',
  view_coa: 'Certificates of Analysis',
} as const;

export function ActionCards() {
  const { card, closeCard } = useApp();
  useEffect(() => {
    if (!card) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && closeCard();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [card, closeCard]);

  if (!card) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={closeCard}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[card.kind]}
        className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-cyan-brand/40 bg-[#050b14] p-5 text-white shadow-[0_0_40px_rgba(61,184,217,0.2)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-head text-lg font-bold text-cyan-text">{TITLES[card.kind]}</h2>
          <button onClick={closeCard} aria-label="Close" className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>
        {card.kind === 'compare_specs' && <Compare slugs={card.slugs ?? []} />}
        {card.kind === 'view_coa' && <CoaList query={card.query ?? ''} />}
        {card.kind === 'bulk_quote' && <BulkQuote fields={card.fields} />}
        {card.kind === 'quick_checkout' && <Checkout fields={card.fields} />}
        <p className="mt-5 text-sm leading-relaxed text-white/50">For laboratory research use only. Not for human or veterinary use. Not evaluated by the FDA.</p>
      </div>
    </div>
  );
}

function Compare({ slugs }: { slugs: string[] }) {
  const { cart, addToCart } = useApp();
  const [items, setItems] = useState<{ p: Product; coas: Coa[] }[] | null>(null);
  const list = (slugs.length ? slugs : cart.map((c) => c.slug)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
  const key = list.join(',');

  useEffect(() => {
    if (!key) return setItems([]);
    Promise.all(key.split(',').map((s) => api.product(s).then((d) => ({ p: d.product, coas: d.coas })).catch(() => null))).then((r) =>
      setItems(r.filter((x): x is { p: Product; coas: Coa[] } => !!x)),
    );
  }, [key]);

  if (!items) return <p className="text-sm text-white/60">Loading…</p>;
  if (!items.length) return <p className="text-sm text-white/70">Ask the assistant to compare two or three products, or add them to your cart first.</p>;

  const rows: [string, (x: { p: Product; coas: Coa[] }) => ReactNode][] = [
    ['Price', (x) => priceLabel(x.p)],
    ['Options', (x) => (x.p.variants.length ? x.p.variants.map((v) => v.label).join(', ') : 'Single')],
    ['Purity (listed)', (x) => (x.p.category === 'supply' ? '—' : x.p.purity)],
    ['Category', (x) => x.p.category],
    ['Latest COA', (x) => (x.coas[0] ? `${x.coas[0].label} · ${x.coas[0].test_date}` : 'Not listed')],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr>
            <th className="w-24" />
            {items.map((x) => (
              <th key={x.p.slug} className="p-2 align-bottom">
                <VialArt product={x.p} className="mx-auto h-20 w-14" />
                <div className="mt-1 text-center text-[13px] font-bold uppercase text-cyan-text">{x.p.name}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, fn]) => (
            <tr key={label} className="border-t border-white/10">
              <td className="p-2 font-semibold text-white/60">{label}</td>
              {items.map((x) => (
                <td key={x.p.slug} className="p-2">{fn(x)}</td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-white/10">
            <td />
            {items.map((x) => (
              <td key={x.p.slug} className="p-2">
                <button onClick={() => addToCart({ slug: x.p.slug, name: x.p.name, variant: null, price: x.p.price_min, qty: 1, image_url: x.p.image_url })} className="w-full rounded-full bg-cyan-soft py-1.5 text-[13px] font-semibold">
                  Add to cart
                </button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CoaList({ query }: { query: string }) {
  const [q, setQ] = useState(query);
  const [coas, setCoas] = useState<Coa[] | null>(null);
  useEffect(() => setQ(query), [query]);
  useEffect(() => {
    const t = setTimeout(() => api.coas(q).then(setCoas).catch(() => setCoas([])), 150);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by product name" aria-label="Filter COAs" className="field" />
      <ul className="mt-3 space-y-2">
        {coas?.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0a1628] px-3 py-2 text-xs">
            <span>
              <b>{c.label}</b>
              <span className="block text-white/50">Batch {c.batch} · tested {c.test_date}</span>
            </span>
            {c.file_url ? (
              <a href={c.file_url} target="_blank" rel="noreferrer" className="rounded bg-[#2a6fd1] px-3 py-1 font-semibold">
                View COA
              </a>
            ) : (
              <span className="text-white/40">On request</span>
            )}
          </li>
        ))}
        {coas && !coas.length && <li className="text-sm text-white/60">No COA listed for that product yet. Ask us via the contact page.</li>}
      </ul>
    </div>
  );
}

function useFields(initial: Record<string, string>) {
  const [f, setF] = useState<Record<string, string>>(initial);
  // Merge assistant pre-fills as they arrive during the voice conversation.
  useEffect(() => setF((cur) => ({ ...cur, ...initial })), [initial]);
  const bind = (k: string) => ({ value: f[k] ?? '', onChange: (e: { target: { value: string } }) => setF((c) => ({ ...c, [k]: e.target.value })) });
  return { f, bind };
}

/** Tiny green "send on WhatsApp" block shown after a quote or order is created. */
function WhatsAppDone({ title, body, waUrl, brochureUrl, sentViaCloud }: { title: string; body: string; waUrl: string; brochureUrl: string; sentViaCloud: boolean }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-lg font-bold text-cyan-text">{title}</p>
      <p className="text-white/80">{body}</p>
      {sentViaCloud && <p className="text-emerald-300">We also sent the brochure link to your WhatsApp.</p>}
      <a href={waUrl} target="_blank" rel="noreferrer" className="btn-wa block py-3 text-center text-sm">
        Send on WhatsApp
      </a>
      <Link href={brochureUrl} className="block text-center text-xs text-cyan-text underline">
        View brochure
      </Link>
    </div>
  );
}

/** Open WhatsApp right away when the browser allows it (user tap); otherwise the button stays. */
function openWhatsApp(url: string) {
  if (!url) return;
  try {
    window.open(url, '_blank', 'noopener');
  } catch {}
}

const WA_HINT = 'WhatsApp number with country code (e.g. +923001234567)';

function BulkQuote({ fields }: { fields: Record<string, string> }) {
  const { cart, sessionId, setLeadId, prefillCard } = useApp();
  const { f, bind } = useFields(fields);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ waUrl: string; brochureUrl: string; sentViaCloud: boolean } | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      const { leadId } = await api.lead({
        name: f.name,
        whatsapp: f.whatsapp,
        message: [f.quantity_notes, f.notes].filter(Boolean).join('\n'),
        source: 'bulk_quote',
        consent_whatsapp: true,
        sessionId,
      });
      setLeadId(leadId);
      prefillCard({ name: f.name ?? '', whatsapp: f.whatsapp ?? '' });
      if (cart.length) {
        const q = await api.quote(cart, sessionId, leadId);
        setDone(q);
        openWhatsApp(q.waUrl);
      }
      else setDone({ waUrl: '', brochureUrl: '', sentViaCloud: false });
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  if (done)
    return done.waUrl ? (
      <WhatsAppDone title="Quote ready" body="Tap below to send your quote to our team on WhatsApp. We'll reply there with bulk pricing." {...done} />
    ) : (
      <p className="text-sm">Thanks — our team will contact you on WhatsApp with bulk pricing.</p>
    );

  return (
    <div className="space-y-2.5">
      <input className="field" placeholder="Your name" autoComplete="name" {...bind('name')} />
      <input className="field" type="tel" placeholder={WA_HINT} autoComplete="tel" {...bind('whatsapp')} />
      <textarea className="field h-20" placeholder="Compounds and quantities needed (optional)" {...bind('quantity_notes')} />
      {cart.length > 0 && <p className="text-[13px] text-white/60">Your cart ({cart.length} items) will be attached as a brochure.</p>}
      <p className="text-sm text-white/45">We&apos;ll only use your number to reply about this quote.</p>
      {err && <p className="text-xs text-red-400" role="alert">{err}</p>}
      <button disabled={busy || !f.name || !f.whatsapp} onClick={submit} className="btn-primary w-full">
        {busy ? 'Preparing…' : 'Get quote on WhatsApp'}
      </button>
    </div>
  );
}

function Checkout({ fields }: { fields: Record<string, string> }) {
  const { cart, subtotal, sessionId, clearCart, setQty, prefillCard } = useApp();
  const { f, bind } = useFields(fields);
  const [attest, setAttest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ orderId: number; total: number; waUrl: string; brochureUrl: string; sentViaCloud: boolean } | null>(null);
  const rate = DISCOUNT_CODES[(f.discount_code || '').toUpperCase()] ?? 0;
  const discount = Math.round(subtotal * rate * 100) / 100;

  if (done)
    return (
      <WhatsAppDone
        title={`Order #${done.orderId} ready — ${money(done.total)}`}
        body="Tap below to send your order to our team on WhatsApp. We'll confirm payment and shipping with you there."
        {...done}
      />
    );
  if (!cart.length) return <p className="text-sm text-white/70">Your cart is empty. Browse the shop or ask the assistant to add products.</p>;

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await api.order({ ...f, items: cart, sessionId, attest_research: attest });
      prefillCard({ name: f.name ?? '', whatsapp: f.whatsapp ?? '' });
      setDone(r);
      clearCart();
      openWhatsApp(r.waUrl);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-2.5">
      <ul className="divide-y divide-white/10 rounded-lg border border-white/10 text-xs">
        {cart.map((i) => (
          <li key={i.slug + i.variant} className="flex items-center justify-between px-3 py-2">
            <span>
              {i.name} {i.variant && <span className="text-white/50">({i.variant})</span>}
            </span>
            <span className="flex items-center gap-2">
              <input type="number" min={0} value={i.qty} onChange={(e) => setQty(i.slug, i.variant, Number(e.target.value))} className="w-12 rounded bg-white/10 px-1 py-0.5 text-center" aria-label={`Quantity of ${i.name}`} />
              {money(i.price * i.qty)}
            </span>
          </li>
        ))}
      </ul>
      <input className="field" placeholder="Your name" autoComplete="name" {...bind('name')} />
      <input className="field" type="tel" placeholder={WA_HINT} autoComplete="tel" {...bind('whatsapp')} />
      <div className="grid grid-cols-2 gap-2">
        <input className="field" placeholder="Discount code" {...bind('discount_code')} />
        <input className="field" placeholder="Notes (optional)" {...bind('notes')} />
      </div>
      <div className="rounded-lg bg-white/5 p-3 text-xs">
        <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        {discount > 0 && <div className="flex justify-between text-cyan-text"><span>{f.discount_code?.toUpperCase()} (first order)</span><span>−{money(discount)}</span></div>}
        <div className="flex justify-between"><span>Shipping</span><span>{subtotal >= FREE_SHIPPING_THRESHOLD ? 'Free' : 'Confirmed on WhatsApp'}</span></div>
        <div className="mt-1 flex justify-between border-t border-white/10 pt-1 font-bold"><span>Total</span><span>{money(subtotal - discount)}</span></div>
      </div>
      <label data-ai="off" className="flex items-start gap-2 text-[13px] text-white/80">
        <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-0.5" />
        I am purchasing for in vitro / laboratory research only, not for human or veterinary use.
      </label>
      {err && <p className="text-xs text-red-400" role="alert">{err}</p>}
      <button disabled={busy || !attest || !f.name || !f.whatsapp} onClick={submit} className="btn-wa w-full py-3 text-sm">
        {busy ? 'Preparing…' : 'Send order on WhatsApp'}
      </button>
    </div>
  );
}
