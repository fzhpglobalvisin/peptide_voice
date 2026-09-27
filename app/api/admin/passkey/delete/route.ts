import { getAdminSession } from '@/lib/auth';
import { deletePasskey } from '@/lib/passkeys';
import { bad, json, readJson, s } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return bad('Please sign in first.', 401);
  const b = await readJson<{ id?: string }>(req);
  if (!b?.id) return bad('Missing passkey.');
  await deletePasskey(session.user.id, s(b.id, 400));
  return json({ ok: true });
}
