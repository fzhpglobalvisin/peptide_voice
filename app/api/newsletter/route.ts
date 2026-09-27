import { rateLimit, subscribe } from '@/lib/store';
import { bad, clientIp, json, readJson, s } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!rateLimit(`nl:${await clientIp()}`, 10, 60 * 60 * 1000)) return bad('Too many requests.', 429);
  const b = await readJson<{ email?: string }>(req);
  const email = s(b?.email, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Please enter a valid email.');
  subscribe(email);
  return json({ ok: true });
}
