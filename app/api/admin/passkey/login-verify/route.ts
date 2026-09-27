import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/auth';
import { verifyAuthentication } from '@/lib/passkeys';
import { rateLimit } from '@/lib/store';
import { bad, clientIp, json, readJson } from '@/lib/http';

export const runtime = 'nodejs';

/** Signs the Super admin in with a verified passkey. */
export async function POST(req: Request) {
  if (!rateLimit(`pk-login:${await clientIp()}`, 10, 15 * 60 * 1000)) return bad('Too many attempts. Please wait a few minutes.', 429);
  const b = await readJson<{ response?: AuthenticationResponseJSON }>(req);
  if (!b?.response) return bad('Missing passkey response.');
  try {
    const admin = await verifyAuthentication(b.response);
    (await cookies()).set(ADMIN_COOKIE, createSessionToken(admin.id, admin.session_version), await sessionCookieOptions());
    return json({ ok: true });
  } catch (e) {
    return bad((e as Error).message, 401);
  }
}
