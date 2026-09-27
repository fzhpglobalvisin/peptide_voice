import { getProductsBySlugs, trackEvents } from '@/lib/catalog';
import { createLead, createOrder, createQuote, getSession, rateLimit } from '@/lib/store';
import { orderText, sendCloudTemplate, waLink } from '@/lib/whatsapp';
import { bad, clientIp, json, readJson, s, verifiedVisitor } from '@/lib/http';
import { DISCOUNT_CODES, type CartItem } from '@/lib/types';
import { currentCustomer, updateCustomerDetails } from '@/lib/customers';

export const runtime = 'nodejs';

/**
 * Order request over WhatsApp. Only name + WhatsApp number are needed.
 * Prices are recomputed server-side. Returns a wa.me link that sends the order to the store,
 * and (if the WhatsApp Cloud API is configured) also sends the brochure link to the customer.
 */
export async function POST(req: Request) {
  const visitor = await verifiedVisitor();
  if (!visitor) return bad('Please complete researcher verification first.', 403);
  if (!rateLimit(`order:${await clientIp()}`, 10, 60 * 60 * 1000)) return bad('Too many requests.', 429);

  const b = await readJson<Record<string, unknown>>(req);
  if (!b) return bad('Invalid request');
  if (b.attest_research !== true) return bad('Please tick the research-use confirmation.');

  const name = s(b.name, 120);
  const whatsapp = s(b.whatsapp, 30);
  if (!name) return bad('Please enter your name.');
  if (!/^\+?\d[\d\s()-]{6,}$/.test(whatsapp)) return bad('Please enter your WhatsApp number with country code, e.g. +923001234567.');

  const raw = (Array.isArray(b.items) ? (b.items as CartItem[]) : []).slice(0, 30);
  const products = new Map((await getProductsBySlugs(raw.map((i) => s(i.slug, 120)))).map((p) => [p.slug, p]));
  const items: CartItem[] = [];
  for (const i of raw) {
    const p = products.get(i.slug);
    if (!p || p.status !== 'active') continue;
    const v = p.variants.find((x) => x.label === i.variant);
    items.push({ slug: p.slug, name: p.name, variant: v?.label ?? null, price: v?.price ?? p.price_min, qty: Math.max(1, Math.min(999, Math.floor(Number(i.qty) || 1))), image_url: p.image_url });
  }
  if (!items.length) return bad('Your cart is empty.');

  const subtotal = Math.round(items.reduce((t, i) => t + i.price * i.qty, 0) * 100) / 100;
  const code = s(b.discount_code, 30).toUpperCase();
  const rate = DISCOUNT_CODES[code] ?? 0;
  const discount = Math.round(subtotal * rate * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const notes = s(b.notes, 600) || null;

  const session = b.sessionId ? await getSession(s(b.sessionId, 40)) : undefined;
  const sessionId = session && session.visitor_id === visitor ? session.id : null;
  // Link the order to the signed-in customer (My Account → Orders).
  const customer = await currentCustomer().catch(() => null);
  const leadId = await createLead({ sessionId, name, whatsapp, message: notes, source: 'checkout', consentWhatsapp: true });
  const orderId = await createOrder({
    sessionId,
    leadId,
    customerId: customer?.id ?? null,
    items,
    subtotal,
    discountCode: rate ? code : null,
    discount,
    total,
    institution: '',
    shipAddress: notes ?? '',
  });
  if (customer) {
    if (!customer.name || !customer.whatsapp) await updateCustomerDetails(customer.id, customer.name || name, customer.whatsapp || whatsapp);
  }
  const quote = await createQuote(items, sessionId, leadId, 'wa_link');
  await trackEvents(items.map((i) => i.slug), 'order', sessionId);

  let sentViaCloud = false;
  try {
    sentViaCloud = await sendCloudTemplate(whatsapp, name, quote.id);
  } catch (e) {
    console.error('WhatsApp cloud send failed', e);
  }

  return json({
    ok: true,
    orderId,
    subtotal,
    discount,
    total,
    brochureUrl: `/quote/${quote.id}`,
    waUrl: waLink(orderText({ orderId, quoteId: quote.id, items, subtotal, discountCode: rate ? code : null, discount, total, name, whatsapp, notes })),
    sentViaCloud,
  });
}
