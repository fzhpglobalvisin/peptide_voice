import 'server-only';
import { stmt } from './db';

/** All admin report queries. `since` is unix ms. Each is a single indexed aggregate. */

export function kpis(since: number, until = 8.64e15) {
  return stmt(
    `SELECT
       (SELECT COUNT(*) FROM chat_sessions WHERE started_at >= @since AND started_at < @until) AS sessions,
       (SELECT ROUND(AVG(turn_count),1) FROM chat_sessions WHERE started_at >= @since AND started_at < @until AND status='closed') AS avg_turns,
       (SELECT COUNT(*) FROM leads WHERE created_at >= @since AND created_at < @until) AS leads,
       (SELECT COUNT(*) FROM leads WHERE created_at >= @since AND created_at < @until AND consent_whatsapp = 1) AS wa_optins,
       (SELECT COUNT(*) FROM quotes WHERE created_at >= @since AND created_at < @until) AS quotes,
       (SELECT COUNT(*) FROM orders WHERE created_at >= @since AND created_at < @until) AS orders,
       (SELECT COALESCE(ROUND(SUM(total),2),0) FROM orders WHERE created_at >= @since AND created_at < @until AND status != 'rejected') AS order_value,
       (SELECT COUNT(*) FROM compliance_events WHERE created_at >= @since AND created_at < @until) AS compliance_redirects,
       (SELECT COUNT(*) FROM attestations WHERE created_at >= @since AND created_at < @until) AS attestations,
       (SELECT COUNT(*) FROM orders WHERE status = 'pending_review') AS open_orders`,
  ).get({ since, until }) as Record<string, number>;
}

/** Day (≤90 days) or month buckets with sessions, leads, quotes, orders and order value. */
export function timeSeries(since: number, days: number) {
  const monthly = days > 90;
  const fmt = monthly ? '%Y-%m' : '%Y-%m-%d';
  const rows = stmt(
    `WITH ev(k, t, v) AS (
       SELECT 'sessions', started_at, 0 FROM chat_sessions WHERE started_at >= @since
       UNION ALL SELECT 'leads', created_at, 0 FROM leads WHERE created_at >= @since
       UNION ALL SELECT 'quotes', created_at, 0 FROM quotes WHERE created_at >= @since
       UNION ALL SELECT 'orders', created_at, total FROM orders WHERE created_at >= @since AND status != 'rejected'
     )
     SELECT strftime('${fmt}', t / 1000, 'unixepoch', 'localtime') AS b, k, COUNT(*) AS n, SUM(v) AS v
     FROM ev GROUP BY b, k`,
  ).all({ since }) as { b: string; k: string; n: number; v: number }[];

  // Fill every bucket so empty days show as zero.
  const labels: string[] = [];
  const d = new Date(since);
  const now = new Date();
  if (monthly) {
    d.setDate(1);
    while (d <= now) {
      labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    d.setHours(0, 0, 0, 0);
    while (d <= now) {
      labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      d.setDate(d.getDate() + 1);
    }
  }
  const idx = new Map(labels.map((l, i) => [l, i]));
  const zero = () => new Array(labels.length).fill(0);
  const out = { labels, monthly, sessions: zero(), leads: zero(), quotes: zero(), orders: zero(), value: zero() };
  for (const r of rows) {
    const i = idx.get(r.b);
    if (i === undefined) continue;
    (out as unknown as Record<string, number[]>)[r.k][i] = r.n;
    if (r.k === 'orders') out.value[i] = Math.round((r.v ?? 0) * 100) / 100;
  }
  return out;
}

/** Totals for the view → recommend → cart → quote → order funnel. */
export function funnel(since: number) {
  const r = stmt(
    `SELECT SUM(type='view') AS views, SUM(type='ai_recommend') AS ai_recs, SUM(type='cart_add') AS cart_adds,
            SUM(type='quote') AS quotes, SUM(type='order') AS orders
     FROM product_events WHERE created_at >= ?`,
  ).get(since) as Record<string, number | null>;
  return [
    { label: 'Views', n: r.views ?? 0 },
    { label: 'AI recommended', n: r.ai_recs ?? 0 },
    { label: 'Added to cart', n: r.cart_adds ?? 0 },
    { label: 'Quoted', n: r.quotes ?? 0 },
    { label: 'Ordered', n: r.orders ?? 0 },
  ];
}

export function orderStatusBreakdown(since: number) {
  return stmt(`SELECT status AS label, COUNT(*) AS n FROM orders WHERE created_at >= ? GROUP BY status ORDER BY n DESC`).all(since) as {
    label: string;
    n: number;
  }[];
}

export interface ActivityItem {
  kind: 'session' | 'lead' | 'quote' | 'order' | 'compliance';
  at: number;
  title: string;
  detail: string;
  href?: string;
}

/** Latest events across the store, newest first. */
export function recentActivity(limit = 20): ActivityItem[] {
  const rows = stmt(
    `SELECT * FROM (
       SELECT 'session' AS kind, started_at AS at, id AS ref, COALESCE(language,'') AS a, turn_count AS b, status AS c FROM chat_sessions
       UNION ALL SELECT 'lead', created_at, CAST(id AS TEXT), name, source, COALESCE(whatsapp,'') FROM leads
       UNION ALL SELECT 'quote', created_at, id, CAST(subtotal AS TEXT), '', '' FROM quotes
       UNION ALL SELECT 'order', o.created_at, CAST(o.id AS TEXT), COALESCE(l.name,''), CAST(o.total AS TEXT), o.status FROM orders o LEFT JOIN leads l ON l.id = o.lead_id
       UNION ALL SELECT 'compliance', created_at, COALESCE(session_id,''), category, '', '' FROM compliance_events
     ) ORDER BY at DESC LIMIT ?`,
  ).all(limit) as { kind: ActivityItem['kind']; at: number; ref: string; a: string; b: string | number; c: string }[];
  return rows.map((r) => {
    switch (r.kind) {
      case 'session':
        return { kind: r.kind, at: r.at, title: 'Voice session', detail: `${r.b} turns${r.a ? ` · ${r.a}` : ''} · ${r.c}`, href: `/admin/sessions/${r.ref}` };
      case 'lead':
        return { kind: r.kind, at: r.at, title: `New lead: ${r.a}`, detail: `${String(r.b).replace('_', ' ')}${r.c ? ` · ${r.c}` : ''}`, href: '/admin/leads' };
      case 'quote':
        return { kind: r.kind, at: r.at, title: `Quote #${r.ref}`, detail: `$${Number(r.a).toFixed(2)}`, href: `/quote/${r.ref}` };
      case 'order':
        return { kind: r.kind, at: r.at, title: `Order #${r.ref}${r.a ? ` · ${r.a}` : ''}`, detail: `$${Number(r.b).toFixed(2)} · ${r.c.replace('_', ' ')}`, href: '/admin/leads' };
      default:
        return { kind: r.kind, at: r.at, title: 'Compliance redirect', detail: r.a.replace('_', ' '), href: r.ref ? `/admin/sessions/${r.ref}` : undefined };
    }
  });
}

export function productPerformance(since: number) {
  return stmt(
    `SELECT p.id, p.name, p.slug, p.status,
       COALESCE(SUM(e.type='view'),0)         AS views,
       COALESCE(SUM(e.type='ai_recommend'),0) AS ai_recs,
       COALESCE(SUM(e.type='cart_add'),0)     AS cart_adds,
       COALESCE(SUM(e.type='quote'),0)        AS quotes,
       COALESCE(SUM(e.type='order'),0)        AS orders,
       ROUND(100.0 * SUM(e.type='order') / NULLIF(SUM(e.type='view'),0), 1) AS view_to_order_pct
     FROM products p
     LEFT JOIN product_events e ON e.product_id = p.id AND e.created_at >= ?
     GROUP BY p.id
     ORDER BY orders DESC, cart_adds DESC, views DESC
     LIMIT 60`,
  ).all(since) as {
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
  }[];
}

type CountRow = { label: string | null; n: number };

export function languageBreakdown(since: number) {
  return stmt(
    `SELECT COALESCE(language,'unknown') AS label, COUNT(*) AS n FROM chat_sessions WHERE started_at >= ? GROUP BY label ORDER BY n DESC`,
  ).all(since) as CountRow[];
}

export function researchBreakdown(since: number) {
  const base = `FROM research_context r JOIN chat_sessions s ON s.id = r.session_id WHERE s.started_at >= ?`;
  return {
    institution: stmt(`SELECT COALESCE(r.institution_type,'not given') AS label, COUNT(*) AS n ${base} GROUP BY label ORDER BY n DESC`).all(since) as CountRow[],
    scale: stmt(`SELECT COALESCE(r.quantity_scale,'not given') AS label, COUNT(*) AS n ${base} GROUP BY label ORDER BY n DESC`).all(since) as CountRow[],
    area: stmt(`SELECT r.research_area AS label, COUNT(*) AS n ${base} AND r.research_area IS NOT NULL GROUP BY lower(r.research_area) ORDER BY n DESC LIMIT 10`).all(since) as CountRow[],
    coa: stmt(`SELECT CASE r.coa_required WHEN 1 THEN 'COA required' WHEN 0 THEN 'Not required' ELSE 'not given' END AS label, COUNT(*) AS n ${base} GROUP BY label ORDER BY n DESC`).all(since) as CountRow[],
  };
}

export function leadFunnel(since: number) {
  return stmt(
    `SELECT source AS label, COUNT(*) AS n,
       SUM(consent_whatsapp) AS optins,
       SUM(EXISTS (SELECT 1 FROM orders o WHERE o.lead_id = l.id)) AS converted
     FROM leads l WHERE created_at >= ? GROUP BY source ORDER BY n DESC`,
  ).all(since) as { label: string; n: number; optins: number; converted: number }[];
}

export function complianceBreakdown(since: number) {
  return stmt(
    `SELECT category AS label, COUNT(*) AS n FROM compliance_events WHERE created_at >= ? GROUP BY category ORDER BY n DESC`,
  ).all(since) as CountRow[];
}

export function recentSessions(limit = 25) {
  return stmt(
    `SELECT s.id, s.language, s.status, s.turn_count, s.started_at, s.ended_at, s.summary,
       r.institution_type, r.quantity_scale,
       (SELECT COUNT(*) FROM compliance_events c WHERE c.session_id = s.id) AS redirects
     FROM chat_sessions s LEFT JOIN research_context r ON r.session_id = s.id
     ORDER BY s.started_at DESC LIMIT ?`,
  ).all(limit) as {
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
  }[];
}

export function sessionDetail(id: string) {
  const s = stmt(`SELECT * FROM chat_sessions WHERE id=?`).get(id) as
    | { id: string; language: string | null; status: string; transcript: string; summary: string | null; started_at: number; ended_at: number | null }
    | undefined;
  if (!s) return null;
  return {
    ...s,
    research: stmt(`SELECT * FROM research_context WHERE session_id=?`).get(id) as Record<string, unknown> | undefined,
    compliance: stmt(`SELECT category, excerpt, created_at FROM compliance_events WHERE session_id=? ORDER BY created_at`).all(id) as {
      category: string;
      excerpt: string | null;
      created_at: number;
    }[],
    leads: stmt(`SELECT id, name, whatsapp, email, institution, source, created_at FROM leads WHERE session_id=?`).all(id) as Record<string, unknown>[],
  };
}

export function recentLeads(limit = 100) {
  return stmt(
    `SELECT l.*, (SELECT COUNT(*) FROM orders o WHERE o.lead_id = l.id) AS orders FROM leads l ORDER BY l.created_at DESC LIMIT ?`,
  ).all(limit) as {
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
  }[];
}

export function recentOrders(limit = 100) {
  return stmt(
    `SELECT o.id, o.items, o.total, o.discount_code, o.institution, o.ship_address, o.status, o.created_at, l.name, l.email, l.whatsapp
     FROM orders o LEFT JOIN leads l ON l.id = o.lead_id ORDER BY o.created_at DESC LIMIT ?`,
  ).all(limit) as {
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
  }[];
}

export function setOrderStatus(id: number, status: string) {
  stmt(`UPDATE orders SET status=? WHERE id=?`).run(status, id);
}
