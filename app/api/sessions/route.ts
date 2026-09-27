import { createSession, rateLimit } from '@/lib/store';
import { bad, clientIp, json, verifiedVisitor } from '@/lib/http';

export const runtime = 'nodejs';

/** Start a chat session. */
export async function POST() {
  const visitor = await verifiedVisitor();
  if (!visitor) return bad('Please complete researcher verification first.', 403);
  const max = Number(process.env.LIVE_SESSIONS_PER_IP_PER_HOUR || 12);
  if (!rateLimit(`sess:${await clientIp()}`, max, 60 * 60 * 1000)) return bad('Too many sessions. Please try again later.', 429);
  return json({ sessionId: await createSession(visitor) });
}
