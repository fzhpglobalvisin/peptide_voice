import { isAdminRequest } from '@/lib/auth';
import { recentLeads, recentOrders } from '@/lib/analytics';

export const runtime = 'nodejs';

const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const t = v === null || v === undefined ? '' : String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@]/.test(t) ? `'${t}` : t;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
};

export async function GET(req: Request) {
  if (!(await isAdminRequest())) return new Response('Forbidden', { status: 403 });
  const type = new URL(req.url).searchParams.get('type');
  const rows =
    type === 'orders'
      ? (await recentOrders(10000)).map((o) => ({ ...o, created_at: new Date(o.created_at).toISOString() }))
      : (await recentLeads(10000)).map((l) => ({ ...l, created_at: new Date(l.created_at).toISOString() }));
  return new Response(csv(rows as Record<string, unknown>[]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ridgeline-${type === 'orders' ? 'orders' : 'leads'}.csv"`,
    },
  });
}
