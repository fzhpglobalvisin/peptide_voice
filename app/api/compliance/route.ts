import { COMPLIANCE_CATEGORIES, getSession, logCompliance, type ComplianceCategory } from '@/lib/store';
import { json, readJson, s, verifiedVisitor } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const visitor = await verifiedVisitor();
  const b = await readJson<{ sessionId?: string; category?: string; excerpt?: string }>(req);
  if (!visitor || !b) return json({ ok: false }, 400);
  const session = b.sessionId ? getSession(s(b.sessionId, 40)) : undefined;
  const cat = (COMPLIANCE_CATEGORIES as readonly string[]).includes(b.category ?? '') ? (b.category as ComplianceCategory) : 'other';
  logCompliance(session && session.visitor_id === visitor ? session.id : null, cat, s(b.excerpt, 300) || null);
  return json({ ok: true });
}
