import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { newId, recordAttestation } from '@/lib/store';
import { VERIFIED_COOKIE, VERIFIED_DAYS, VISITOR_COOKIE, bad, readJson, requestIsHttps } from '@/lib/http';

export const runtime = 'nodejs';

/** Researcher gate: records the confirmation and remembers it on this device for 30 days. */
export async function POST(req: Request) {
  const body = await readJson<{ age?: boolean; researcher?: boolean }>(req);
  if (!body?.age || !body?.researcher) return bad('Both confirmations are required.');

  const jar = await cookies();
  const visitorId = jar.get(VISITOR_COOKIE)?.value || newId(12);
  await recordAttestation(visitorId, req.headers.get('user-agent'));

  const expiresAt = Date.now() + VERIFIED_DAYS * 86400 * 1000;
  const res = NextResponse.json({ ok: true, visitorId, expiresAt });
  const base = { httpOnly: true, sameSite: 'lax' as const, secure: await requestIsHttps(req), path: '/' };
  // The gate stays hidden for 30 days on this device; after that it asks again.
  res.cookies.set(VERIFIED_COOKIE, '1', { ...base, maxAge: VERIFIED_DAYS * 86400 });
  // Anonymous visitor id kept for analytics continuity.
  res.cookies.set(VISITOR_COOKIE, visitorId, { ...base, maxAge: 60 * 60 * 24 * 365 });
  return res;
}
