import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { getAdminSession } from '@/lib/auth';
import { getAdminById } from '@/lib/admin-users';
import { verifyRegistration } from '@/lib/passkeys';
import { bad, json, readJson, s } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getAdminSession();
  const admin = session ? await getAdminById(session.user.id) : undefined;
  if (!admin) return bad('Please sign in first.', 401);
  const b = await readJson<{ response?: RegistrationResponseJSON; name?: string }>(req);
  if (!b?.response) return bad('Missing passkey response.');
  try {
    await verifyRegistration(admin, b.response, s(b.name, 60));
    return json({ ok: true });
  } catch (e) {
    return bad((e as Error).message);
  }
}
