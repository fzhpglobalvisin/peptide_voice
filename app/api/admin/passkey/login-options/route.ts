import { authenticationOptions, passkeyCount } from '@/lib/passkeys';
import { rateLimit } from '@/lib/store';
import { bad, clientIp, json } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST() {
  if (!rateLimit(`pk-opt:${await clientIp()}`, 20, 15 * 60 * 1000)) return bad('Too many attempts. Please wait a few minutes.', 429);
  if (!await passkeyCount()) return bad('No passkey has been set up yet. Sign in with your User ID and password, then add one in Account.', 404);
  try {
    return json(await authenticationOptions());
  } catch (e) {
    return bad((e as Error).message, 500);
  }
}
