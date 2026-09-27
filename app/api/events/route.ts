import { trackEvents, type EventType } from '@/lib/catalog';
import { json, readJson, s } from '@/lib/http';

export const runtime = 'nodejs';
const TYPES: EventType[] = ['view', 'ai_recommend', 'cart_add', 'quote', 'order'];

export async function POST(req: Request) {
  const b = await readJson<{ slugs?: string[]; type?: EventType; sessionId?: string }>(req);
  if (!b || !Array.isArray(b.slugs) || !b.type || !TYPES.includes(b.type)) return json({ ok: false }, 400);
  // Orders are recorded server-side only.
  if (b.type === 'order') return json({ ok: false }, 400);
  await trackEvents(b.slugs.map((x) => s(x, 120)), b.type, s(b.sessionId, 40) || null);
  return json({ ok: true });
}
