import { createLead, getSession, rateLimit } from '@/lib/store';
import { bad, clientIp, json, readJson, s, verifiedVisitor } from '@/lib/http';

export const runtime = 'nodejs';
const SOURCES = ['voice', 'contact', 'bulk_quote'] as const;

export async function POST(req: Request) {
  const visitor = await verifiedVisitor();
  if (!visitor) return bad('Please complete researcher verification first.', 403);
  if (!rateLimit(`lead:${await clientIp()}`, 20, 60 * 60 * 1000)) return bad('Too many submissions.', 429);

  const b = await readJson<Record<string, unknown>>(req);
  if (!b) return bad('Invalid request');
  const name = s(b.name, 120);
  const email = s(b.email, 200);
  const whatsapp = s(b.whatsapp, 30);
  if (!name) return bad('Name is required.');
  if (!email && !whatsapp) return bad('An email or WhatsApp number is required.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Please enter a valid email.');
  if (whatsapp && !/^\+?\d[\d\s-]{6,}$/.test(whatsapp)) return bad('Please enter a WhatsApp number with country code.');

  const source = (SOURCES as readonly string[]).includes(String(b.source)) ? (b.source as (typeof SOURCES)[number]) : 'contact';
  const session = b.sessionId ? getSession(s(b.sessionId, 40)) : undefined;

  const id = createLead({
    sessionId: session && session.visitor_id === visitor ? session.id : null,
    name,
    email: email || null,
    whatsapp: whatsapp || null,
    institution: s(b.institution, 200) || null,
    message: s(b.message, 2000) || null,
    source,
    consentWhatsapp: b.consent_whatsapp === true,
  });
  return json({ ok: true, leadId: id });
}
