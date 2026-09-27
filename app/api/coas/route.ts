import { listCoas } from '@/lib/catalog';
import { json } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.slice(0, 100) ?? '';
  return json({ coas: listCoas(q) });
}
