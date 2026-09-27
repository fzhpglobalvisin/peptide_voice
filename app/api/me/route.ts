import { currentCustomer } from '@/lib/customers';
import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The signed-in customer's contact details (used to pre-fill quote and order forms). */
export async function GET() {
  const c = await currentCustomer().catch(() => null);
  return json(c ? { signedIn: true, name: c.name, whatsapp: c.whatsapp, email: c.email } : { signedIn: false });
}
