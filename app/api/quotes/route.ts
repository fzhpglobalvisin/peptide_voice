import { getProductsBySlugs, trackEvents } from '@/lib/catalog';
import { createQuote, getLeadForQuote, getSession, rateLimit } from '@/lib/store';
import { quoteText, sendCloudTemplate, waLink } from '@/lib/whatsapp';
import { bad, clientIp, json, readJson, s, verifiedVisitor } from '@/lib/http';
import type { CartItem } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * Build a quote brochure from cart items. Prices are re-read from the database, never trusted from the client.
 * Returns a wa.me link (customer → store) and, if the Cloud API is configured and the lead opted in,
 * also sends the brochure link to the customer's WhatsApp via an approved template.
 */
export async function POST(req: Request) {
  const visitor = await verifiedVisitor();
  if (!visitor) return bad('Please complete researcher verification first.', 403);
  if (!rateLimit(`quote:${await clientIp()}`, 30, 60 * 60 * 1000)) return bad('Too many requests.', 429);

  const b = await readJson<{ items?: CartItem[]; sessionId?: string; leadId?: number }>(req);
  const raw = Array.isArray(b?.items) ? b!.items.slice(0, 30) : [];
  if (!raw.length) return bad('Add at least one product to the quote.');

  const products = new Map((await getProductsBySlugs(raw.map((i) => s(i.slug, 120)))).map((p) => [p.slug, p]));
  const items: CartItem[] = [];
  for (const i of raw) {
    const p = products.get(i.slug);
    if (!p || p.status !== 'active') continue;
    const v = p.variants.find((x) => x.label === i.variant);
    items.push({
      slug: p.slug,
      name: p.name,
      variant: v?.label ?? null,
      price: v?.price ?? p.price_min,
      qty: Math.max(1, Math.min(999, Math.floor(Number(i.qty) || 1))),
      image_url: p.image_url,
    });
  }
  if (!items.length) return bad('Those products are not available.');

  const session = b?.sessionId ? await getSession(s(b.sessionId, 40)) : undefined;
  const sessionId = session && session.visitor_id === visitor ? session.id : null;
  const lead = b?.leadId ? await getLeadForQuote(Number(b.leadId)) : undefined;

  const cloudConfigured = !!(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME);
  const canCloud = cloudConfigured && !!(lead?.consent_whatsapp && lead.whatsapp);
  const quote = await createQuote(items, sessionId, lead?.id ?? null, canCloud ? 'wa_cloud' : 'wa_link');
  await trackEvents(items.map((i) => i.slug), 'quote', sessionId);

  let sentViaCloud = false;
  if (canCloud) {
    try {
      sentViaCloud = await sendCloudTemplate(lead!.whatsapp!, lead!.name, quote.id);
    } catch (e) {
      console.error('WhatsApp cloud send failed', e);
    }
  }

  return json({
    quoteId: quote.id,
    subtotal: quote.subtotal,
    brochureUrl: `/quote/${quote.id}`,
    waUrl: waLink(quoteText(quote.id, items, lead?.name, lead?.whatsapp)),
    sentViaCloud,
  });
}
