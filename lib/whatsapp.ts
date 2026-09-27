import 'server-only';
import type { CartItem } from './types';
import { money } from './types';

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Structured WhatsApp text for a quote brochure. The link unfurls into the image brochure page. */
export function quoteText(quoteId: string, items: CartItem[], name?: string | null, whatsapp?: string | null) {
  const lines = items.map((i) => `• *${i.name}*${i.variant ? ` (${i.variant})` : ''} × ${i.qty} — ${money(i.price * i.qty)}`);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  return [
    `*Ridgeline Fit — Research Quote ${quoteId}*`,
    name ? `Name: ${name}` : null,
    whatsapp ? `WhatsApp: ${whatsapp}` : null,
    '',
    ...lines,
    '',
    `Subtotal: *${money(subtotal)}*`,
    subtotal >= 300 ? 'Free US shipping applies.' : 'Free US shipping on orders over $300.',
    '',
    `Brochure with images & COAs: ${siteUrl()}/quote/${quoteId}`,
    '',
    '_For laboratory research use only. Not for human or veterinary use._',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/** Structured WhatsApp text for an order request. */
export function orderText(o: {
  orderId: number;
  quoteId: string;
  items: CartItem[];
  subtotal: number;
  discountCode: string | null;
  discount: number;
  total: number;
  name: string;
  whatsapp: string;
  notes?: string | null;
}) {
  const lines = o.items.map((i) => `• *${i.name}*${i.variant ? ` (${i.variant})` : ''} × ${i.qty} — ${money(i.price * i.qty)}`);
  return [
    `*Ridgeline Fit — Order request #${o.orderId}*`,
    `Name: ${o.name}`,
    `WhatsApp: ${o.whatsapp}`,
    '',
    ...lines,
    '',
    `Subtotal: ${money(o.subtotal)}`,
    o.discount ? `Discount (${o.discountCode}): −${money(o.discount)}` : null,
    `*Total: ${money(o.total)}*`,
    o.subtotal >= 300 ? 'Free US shipping applies.' : null,
    o.notes ? `\nNotes: ${o.notes}` : null,
    '',
    `Order brochure: ${siteUrl()}/quote/${o.quoteId}`,
    '',
    'Please confirm payment and shipping details with me here.',
    '_Purchased for laboratory research use only. Not for human or veterinary use._',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/** wa.me link: the customer sends the quote to the store's WhatsApp (no Cloud API needed). */
export function waLink(text: string) {
  const biz = (process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER || '').replace(/\D/g, '');
  const msg = encodeURIComponent(text);
  // No number set (or still the example 1555…): open WhatsApp's "choose a chat" screen instead of failing.
  if (biz.length < 8 || biz.startsWith('1555')) {
    if (biz) console.warn('[whatsapp] NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER is still the example number; set the store\'s real WhatsApp number.');
    return `https://wa.me/?text=${msg}`;
  }
  return `https://wa.me/${biz}?text=${msg}`;
}

/**
 * Optional: WhatsApp Cloud API template send to the customer's number (only after opt-in).
 * Business-initiated messages require an approved template: body {{1}} = name, {{2}} = quote URL.
 */
export async function sendCloudTemplate(to: string, name: string, quoteId: string): Promise<boolean> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!token || !phoneId || !template) return false;
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'template',
      template: {
        name: template,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en_US' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: name.slice(0, 60) },
              { type: 'text', text: `${siteUrl()}/quote/${quoteId}` },
            ],
          },
        ],
      },
    }),
  });
  return res.ok;
}
