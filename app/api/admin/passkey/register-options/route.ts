import { getAdminSession } from '@/lib/auth';
import { getAdminById } from '@/lib/admin-users';
import { registrationOptions } from '@/lib/passkeys';
import { bad, json } from '@/lib/http';

export const runtime = 'nodejs';

/** Signed-in Super admin starts adding a passkey. */
export async function POST() {
  const session = await getAdminSession();
  const admin = session ? await getAdminById(session.user.id) : undefined;
  if (!admin) return bad('Please sign in first.', 401);
  try {
    return json(await registrationOptions(admin));
  } catch (e) {
    return bad((e as Error).message, 500);
  }
}
