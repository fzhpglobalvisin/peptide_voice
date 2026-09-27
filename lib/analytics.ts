import 'server-only';
import { exec, one, q } from './db';

/** All admin report queries. `since` is unix ms. Each is a single indexed aggregate. */

/** Time zone used for day/month buckets on the dashboard (IANA name, e.g. "Asia/Kolkata"). */
function storeTz() {
  const tz = process.env.STORE_TIMEZONE || 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

export async function kpis(since: number, until = 8.64e15) {
  const r = await one<Record<string, number | null>>(
    `SELECT
       (SELECT COUNT(*) FROM chat_sessions WHERE started_at >= $1 AND started_at < $2) AS sessions,
       (SELECT ROUND(AVG(turn_count)::numeric, 1) FROM chat_sessions WHERE started_at >= $1 AND started_at < $2 AND status='closed') AS avg_turns,
       (SELECT COUNT(*) FROM leads WHERE created_at >= $1 AND created_at < $2) AS leads,
       (SELECT COUNT(*) FROM leads WHERE created_at >= $1 AND created_at < $2 AND consent_whatsapp = 1) AS wa_optins,
       (SELECT COUNT(*) FROM quotes WHERE created_at >= $1 AND created_at < $2) AS quotes,
       (SELECT COUNT(*) FROM orders WHERE created_at >= $1 AND created_at < $2) AS orders,
       (SELECT COALESCE(ROUND(SUM(total)::numeric, 2), 0) FROM orders WHERE created_at >= $1 AND created_at < $2 AND status <> 'rejected') AS order_value,
       (SELECT COUNT(*) FROM compliance_events WHERE created_at >= $1 AND created_at < $2) AS compliance_redirects,
       (SELECT COUNT(*) FROM attestations WHERE created_at >= $1 AND created_at < $2) AS attestations,
       (SELECT COUNT(*) FROM orders WHERE status = 'pending_review') AS open_orders`,
    [Math.floor(since), Math.floor(Math.min(until, 8.64e15))],
  );
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(r ?? {})) out[k] = Number(v ?? 0);
  return out;
}

/** Day (≤90 days) or month buckets with sessions, leads, quotes, orders and order value. */
export async function timeSeries(since: number, days: number) {
  const monthly = days > 90;
  const tz = storeTz();
  const fmt = monthly ? 'YYYY-MM' : 'YYYY-MM-DD';
  const rows = await q<{ b: string; k: string; n: number; v: number | null }>(
    `WITH ev(k, t, v) AS (
       SELECT 'sessions', started_at, 0::double precision FROM chat_sessions WHERE started_at >= $1
       UNION ALL SELECT 'leads', created_at, 0 FROM leads WHERE created_at >= $1
       UNION ALL SELECT 'quotes', created_at, 0 FROM quotes WHERE created_at >= $1
       UNION ALL SELECT 'orders', created_at, total FROM orders WHERE created_at >= $1 AND status <> 'rejected'
     )
     SELECT to_char(to_timestamp(t / 1000.0) AT TIME ZONE $2::text,'${fmt}') AS b, k, COUNT(*) AS n, SUM(v) AS v
     FROM ev GROUP BY 1, 2`,
    [Math.floor(since), tz],
  );

  // Fill every bucket (in the store time zone) so empty days show as zero.
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const labels: string[] = [];
  const seen = new Set<string>();
  const now = Date.now();
  for (let t = since; t <= now + 43_200_000; t += 43_200_000) {
    // half-day steps so DST shifts never skip a date
    const day = dayFmt.format(new Date(Math.min(t, now)));
    const label = monthly ? day.slice(0, 7) : day;
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  const idx = new Map(labels.map((l, i) => [l, i]));
  const zero = () => new Array<number>(labels.length).fill(0);
  const out = { labels, monthly, sessions: zero(), leads: zero(), quotes: zero(), orders: zero(), value: zero() };
  for (const r of rows) {
    const i = idx.get(r.b);
    if (i === undefined) continue;
    (out as unknown as Record<string, number[]>)[r.k][i] = Number(r.n);
    if (r.k === 'orders') out.value[i] = Math.round(Number(r.v ?? 0) * 100) / 100;
  }
  return out;
}

/** Totals for the view → recommend → cart → quote → order funnel. */
export async function funnel(since: number) {
  const r = (await one<Record<string, number | null>>(
    `SELECT COUNT(*) FILTER (WHERE type='view') AS views,
            COUNT(*) FILTER (WHERE type='ai_recommend') AS ai_recs,
            COUNT(*) FILTER (WHERE type='cart_add') AS cart_adds,
            COUNT(*) FILTER (WHERE type='quote') AS quotes,
            COUNT(*) FILTER (WHERE type='order') AS orders
     FROM product_events WHERE created_at >= ?`,
    [Math.floor(since)],
  )) ?? {};
  return [
    { label: 'Views', n: Number(r.views ?? 0) },
    { label: 'AI recommended', n: Number(r.ai_recs ?? 0) },
    { label: 'Added to cart', n: Number(r.cart_adds ?? 0) },
    { label: 'Quoted', n: Number(r.quotes ?? 0) },
    { label: 'Ordered', n: Number(r.orders ?? 0) },
  ];
}

export async function orderStatusBreakdown(since: number) {
  return q<{ label: string; n: number }>(
    `SELECT status AS label, COUNT(*) AS n FROM orders WHERE created_at >= ? GROUP BY status ORDER BY n DESC`,
    [Math.floor(since)],
  );
}

export interface ActivityItem {
  kind: 'session' | 'lead' | 'quote' | 'order' | 'compliance';
  at: number;
  title: string;
  detail: string;
  href?: string;
}

/** Latest events across the store, newest first. */
export async function recentActivity(limit = 20): Promise<ActivityItem[]> {
  const rows = await q<{ kind: ActivityItem['kind']; at: number; ref: string; a: string; b: string; c: string }>(
    `SELECT * FROM (
       SELECT 'session' AS kind, started_at AS at, id AS ref, COALESCE(language,'') AS a, turn_count::text AS b, status AS c FROM chat_sessions
       UNION ALL SELECT 'lead', created_at, id::text, name, source, COALESCE(whatsapp,'') FROM leads
       UNION ALL SELECT 'quote', created_at, id, subtotal::text, '', '' FROM quotes
       UNION ALL SELECT 'order', o.created_at, o.id::text, COALESCE(l.name,''), o.total::text, o.status FROM orders o LEFT JOIN leads l ON l.id = o.lead_id
       UNION ALL SELECT 'compliance', created_at, COALESCE(session_id,''), category, '', '' FROM compliance_events
     ) act ORDER BY at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => {
    const at = Number(r.at);
    switch (r.kind) {
      case 'session':
        return { kind: r.kind, at, title: 'Voice session', detail: `${r.b} turns${r.a ? ` · ${r.a}` : ''} · ${r.c}`, href: `/admin/sessions/${r.ref}` };
      case 'lead':
        return { kind: r.kind, at, title: `New lead: ${r.a}`, detail: `${String(r.b).replace('_', ' ')}${r.c ? ` · ${r.c}` : ''}`, href: '/admin/leads' };
      case 'quote':
        return { kind: r.kind, at, title: `Quote #${r.ref}`, detail: `$${Number(r.a).toFixed(2)}`, href: `/quote/${r.ref}` };
      case 'order':
        return { kind: r.kind, at, title: `Order #${r.ref}${r.a ? ` · ${r.a}` : ''}`, detail: `$${Number(r.b).toFixed(2)} · ${r.c.replace('_', ' ')}`, href: '/admin/leads' };
      default:
        return { kind: r.kind, at, title: 'Compliance redirect', detail: r.a.replace('_', ' '), href: r.ref ? `/admin/sessions/${r.ref}` : undefined };
    }
  });
}

export async function productPerformance(since: number) {
  return q<{
    id: number;
    name: string;
    slug: string;
    status: string;
    views: number;
    ai_recs: number;
    cart_adds: number;
    quotes: number;
    orders: number;
    view_to_order_pct: number | null;
  }>(
    `SELECT p.id, p.name, p.slug, p.status,
       COUNT(e.id) FILTER (WHERE e.type='view')         AS views,
       COUNT(e.id) FILTER (WHERE e.type='ai_recommend') AS ai_recs,
       COUNT(e.id) FILTER (WHERE e.type='cart_add')     AS cart_adds,
       COUNT(e.id) FILTER (WHERE e.type='quote')        AS quotes,
       COUNT(e.id) FILTER (WHERE e.type='order')        AS orders,
       ROUND(100.0 * COUNT(e.id) FILTER (WHERE e.type='order') / NULLIF(COUNT(e.id) FILTER (WHERE e.type='view'), 0), 1) AS view_to_order_pct
     FROM products p
     LEFT JOIN product_events e ON e.product_id = p.id AND e.created_at >= ?
     GROUP BY p.id
     ORDER BY orders DESC, cart_adds DESC, views DESC, p.name
     LIMIT 60`,
    [Math.floor(since)],
  );
}

type CountRow = { label: string | null; n: number };

export async function languageBreakdown(since: number) {
  return q<CountRow>(
    `SELECT COALESCE(language,'unknown') AS label, COUNT(*) AS n FROM chat_sessions WHERE started_at >= ? GROUP BY 1 ORDER BY n DESC`,
    [Math.floor(since)],
  );
}

export async function researchBreakdown(since: number) {
  const base = `FROM research_context r JOIN chat_sessions s ON s.id = r.session_id WHERE s.started_at >= ?`;
  const p = [Math.floor(since)];
  const [institution, scale, area, coa] = await Promise.all([
    q<CountRow>(`SELECT COALESCE(r.institution_type,'not given') AS label, COUNT(*) AS n ${base} GROUP BY 1 ORDER BY n DESC`, p),
    q<CountRow>(`SELECT COALESCE(r.quantity_scale,'not given') AS label, COUNT(*) AS n ${base} GROUP BY 1 ORDER BY n DESC`, p),
    q<CountRow>(
      `SELECT min(r.research_area) AS label, COUNT(*) AS n ${base} AND r.research_area IS NOT NULL GROUP BY lower(r.research_area) ORDER BY n DESC LIMIT 10`,
      p,
    ),
    q<CountRow>(
      `SELECT CASE r.coa_required WHEN 1 THEN 'COA required' WHEN 0 THEN 'Not required' ELSE 'not given' END AS label, COUNT(*) AS n ${base} GROUP BY 1 ORDER BY n DESC`,
      p,
    ),
  ]);
  return { institution, scale, area, coa };
}

export async function leadFunnel(since: number) {
  return q<{ label: string; n: number; optins: number; converted: number }>(
    `SELECT source AS label, COUNT(*) AS n,
       COALESCE(SUM(consent_whatsapp), 0) AS optins,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM orders o WHERE o.lead_id = l.id)) AS converted
     FROM leads l WHERE created_at >= ? GROUP BY source ORDER BY n DESC`,
    [Math.floor(since)],
  );
}

export async function complianceBreakdown(since: number) {
  return q<CountRow>(
    `SELECT category AS label, COUNT(*) AS n FROM compliance_events WHERE created_at >= ? GROUP BY category ORDER BY n DESC`,
    [Math.floor(since)],
  );
}

export async function recentSessions(limit = 25) {
  return q<{
    id: string;
    language: string | null;
    status: string;
    turn_count: number;
    started_at: number;
    ended_at: number | null;
    summary: string | null;
    institution_type: string | null;
    quantity_scale: string | null;
    redirects: number;
  }>(
    `SELECT s.id, s.language, s.status, s.turn_count, s.started_at, s.ended_at, s.summary,
       r.institution_type, r.quantity_scale,
       (SELECT COUNT(*) FROM compliance_events c WHERE c.session_id = s.id) AS redirects
     FROM chat_sessions s LEFT JOIN research_context r ON r.session_id = s.id
     ORDER BY s.started_at DESC LIMIT ?`,
    [limit],
  );
}

export async function sessionDetail(id: string) {
  const s = await one<{
    id: string;
    language: string | null;
    status: string;
    transcript: string;
    summary: string | null;
    started_at: number;
    ended_at: number | null;
  }>(`SELECT * FROM chat_sessions WHERE id=?`, [id]);
  if (!s) return null;
  const [research, compliance, leads] = await Promise.all([
    one<Record<string, unknown>>(`SELECT * FROM research_context WHERE session_id=?`, [id]),
    q<{ category: string; excerpt: string | null; created_at: number }>(
      `SELECT category, excerpt, created_at FROM compliance_events WHERE session_id=? ORDER BY created_at`,
      [id],
    ),
    q<Record<string, unknown>>(`SELECT id, name, whatsapp, email, institution, source, created_at FROM leads WHERE session_id=?`, [id]),
  ]);
  return { ...s, research, compliance, leads };
}

export async function recentLeads(limit = 100) {
  return q<{
    id: number;
    session_id: string | null;
    name: string;
    whatsapp: string | null;
    email: string | null;
    institution: string | null;
    message: string | null;
    source: string;
    consent_whatsapp: number;
    created_at: number;
    orders: number;
  }>(`SELECT l.*, (SELECT COUNT(*) FROM orders o WHERE o.lead_id = l.id) AS orders FROM leads l ORDER BY l.created_at DESC LIMIT ?`, [limit]);
}

export async function recentOrders(limit = 100) {
  return q<{
    id: number;
    items: string;
    total: number;
    discount_code: string | null;
    institution: string;
    ship_address: string;
    status: string;
    created_at: number;
    name: string | null;
    email: string | null;
    whatsapp: string | null;
  }>(
    `SELECT o.id, o.items, o.total, o.discount_code, o.institution, o.ship_address, o.status, o.created_at, l.name, l.email, l.whatsapp
     FROM orders o LEFT JOIN leads l ON l.id = o.lead_id ORDER BY o.created_at DESC LIMIT ?`,
    [limit],
  );
}

export async function setOrderStatus(id: number, status: string) {
  await exec(`UPDATE orders SET status=? WHERE id=?`, [status, id]);
}
