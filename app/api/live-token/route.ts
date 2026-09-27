import { GoogleGenAI } from '@google/genai';
import { buildLiveConfig, LIVE_MODEL } from '@/lib/live-config';
import { getSession, rateLimit } from '@/lib/store';
import { bad, clientIp, json, readJson, s, verifiedVisitor } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Issues a single-use ephemeral token for the Gemini Live API.
 * The browser connects straight to Gemini over WebSocket (lowest latency, no audio proxy),
 * while the real API key, system prompt, tools and model stay locked server-side.
 */
export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) return bad('Voice assistant is not configured.', 503);
  const visitor = await verifiedVisitor();
  if (!visitor) return bad('Please complete researcher verification first.', 403);

  const body = await readJson<{ sessionId?: string; handle?: string }>(req);
  const session = body?.sessionId ? getSession(s(body.sessionId, 40)) : undefined;
  if (!session || session.status !== 'open' || session.visitor_id !== visitor) return bad('Session not found.', 404);

  // Reconnects (token refresh / resumption) are allowed, but capped per session.
  if (!rateLimit(`tok:${session.id}`, 20, 60 * 60 * 1000) || !rateLimit(`tokip:${await clientIp()}`, 60, 60 * 60 * 1000)) {
    return bad('Rate limit reached.', 429);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
      liveConnectConstraints: { model: LIVE_MODEL, config: buildLiveConfig(body?.handle ? s(body.handle, 400) : null) },
      httpOptions: { apiVersion: 'v1alpha' },
    },
  });

  return json({ token: token.name, model: LIVE_MODEL });
}
